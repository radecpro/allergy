import { useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/home";
import {
  allergenIds,
  pollenActivityLabels,
  rankCurrentSymptomAllergens,
  resultGuardrailText,
  symptomCatalog,
  symptomIntensityLabels,
} from "~/domain/allergen-ranking";
import type {
  PollenActivityByAllergen,
  SymptomId,
  SymptomIntensity,
} from "~/domain/allergen-ranking";
import type {
  CitySearchResponse,
  CurrentPollenResponse,
} from "~/domain/current-location/http";
import type { CitySuggestion } from "~/domain/current-location/types";

const minimumSearchLength = 2;
const emptyPollenActivity = Object.fromEntries(
  allergenIds.map((allergenId) => [allergenId, "unknown"]),
) as PollenActivityByAllergen;

type AsyncStatus = "idle" | "loading" | "unavailable";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Allergen Finder | Aktualne objawy" },
    {
      name: "description",
      content:
        "Polski test gościnny łączący bieżące objawy z aktualną aktywnością pyłków.",
    },
  ];
}

function formatSuggestionMeta(suggestion: CitySuggestion): string {
  return [suggestion.adminArea, suggestion.country].filter(Boolean).join(", ");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function formatResultExplanation(explanation: string): string {
  return explanation
    .replace(/^Zgłoszone objawy pasujące do tej grupy: .*?\. /, "")
    .replace("Zgłoszone objawy słabo pasują do tej grupy. ", "")
    .replace(/^Aktualna aktywność dla grupy .*?: .*?\. /, "")
    .replace(resultGuardrailText, "")
    .trim();
}

function GoogleAttribution() {
  return (
    <div className="flex items-center justify-end border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">
      <span className="mr-1">powered by</span>
      <span aria-label="Google" className="font-medium tracking-normal">
        <span className="text-[#4285f4]">G</span>
        <span className="text-[#db4437]">o</span>
        <span className="text-[#f4b400]">o</span>
        <span className="text-[#4285f4]">g</span>
        <span className="text-[#0f9d58]">l</span>
        <span className="text-[#db4437]">e</span>
      </span>
    </div>
  );
}

export default function Home() {
  const [cityQuery, setCityQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [citySearchStatus, setCitySearchStatus] = useState<AsyncStatus>("idle");
  const [citySearchMessage, setCitySearchMessage] = useState("");
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<SymptomId[]>([]);
  const [intensity, setIntensity] = useState<SymptomIntensity | null>(null);
  const [pollenActivity, setPollenActivity] =
    useState<PollenActivityByAllergen>(emptyPollenActivity);
  const [pollenStatus, setPollenStatus] = useState<AsyncStatus>("idle");
  const [pollenMessage, setPollenMessage] = useState("");
  const blurTimeoutRef = useRef<number | null>(null);

  const canSearch = cityQuery.trim().length >= minimumSearchLength;
  const resultsReady =
    selectedCity !== null && selectedSymptomIds.length > 0 && intensity !== null;
  const hasUnknownPollen = allergenIds.some(
    (allergenId) => pollenActivity[allergenId] === "unknown",
  );

  const rankedResults = useMemo(() => {
    if (!resultsReady || intensity === null) {
      return [];
    }

    return rankCurrentSymptomAllergens({
      selectedSymptomIds,
      intensity,
      pollenActivity,
    });
  }, [intensity, pollenActivity, resultsReady, selectedSymptomIds]);

  useEffect(() => {
    const trimmedQuery = cityQuery.trim();

    if (selectedCity?.label === cityQuery) {
      setSuggestions([]);
      setCitySearchStatus("idle");
      setCitySearchMessage("");
      return;
    }

    setSelectedCity(null);
    setPollenActivity(emptyPollenActivity);
    setPollenStatus("idle");
    setPollenMessage("");

    if (trimmedQuery.length < minimumSearchLength) {
      setSuggestions([]);
      setCitySearchStatus("idle");
      setCitySearchMessage("");
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      setCitySearchStatus("loading");
      fetch(`/api/city-search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const payload = (await response.json()) as CitySearchResponse;
          setSuggestions(payload.suggestions);
          setCitySearchStatus(
            payload.status === "ok" || payload.status === "empty"
              ? "idle"
              : "unavailable",
          );
          setCitySearchMessage(payload.message ?? "");
          setIsSuggestionsOpen(true);
        })
        .catch((error: unknown) => {
          if (!isAbortError(error)) {
            setSuggestions([]);
            setCitySearchStatus("unavailable");
            setCitySearchMessage("Wyszukiwanie miast jest chwilowo niedostępne.");
            setIsSuggestionsOpen(true);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [cityQuery, selectedCity?.label]);

  useEffect(() => {
    if (selectedCity === null) {
      return;
    }

    const controller = new AbortController();
    setPollenStatus("loading");
    setPollenMessage("");
    setPollenActivity(emptyPollenActivity);

    fetch(`/api/current-pollen?placeId=${encodeURIComponent(selectedCity.placeId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as CurrentPollenResponse;
        setPollenActivity(payload.pollenActivity);
        setPollenStatus(payload.status === "ok" ? "idle" : "unavailable");
        setPollenMessage(payload.message ?? "");
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) {
          setPollenActivity(emptyPollenActivity);
          setPollenStatus("unavailable");
          setPollenMessage("Aktualne dane pyłkowe są chwilowo niedostępne.");
        }
      });

    return () => controller.abort();
  }, [selectedCity]);

  function handleCityFocus() {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
    }

    if (canSearch) {
      setIsSuggestionsOpen(true);
    }
  }

  function handleCityBlur() {
    blurTimeoutRef.current = window.setTimeout(() => {
      setIsSuggestionsOpen(false);
    }, 150);
  }

  function handleCitySelect(suggestion: CitySuggestion) {
    setSelectedCity(suggestion);
    setCityQuery(suggestion.label);
    setSuggestions([]);
    setIsSuggestionsOpen(false);
    setCitySearchMessage("");
  }

  function toggleSymptom(symptomId: SymptomId) {
    setSelectedSymptomIds((current) =>
      current.includes(symptomId)
        ? current.filter((selectedId) => selectedId !== symptomId)
        : [...current, symptomId],
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid gap-3 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
            Allergen Finder
          </p>
          <div className="grid gap-3 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                Sprawdź, które pyłki mogą dziś pasować do Twoich objawów
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-650">
                Wybierz miasto, zaznacz objawy i poziom nasilenia. Wyniki
                aktualizują się automatycznie i pokazują kontekst orientacyjny.
              </p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              To nie jest diagnoza medyczna. Aplikacja nie zapisuje historii
              lokalizacji ani objawów.
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,25rem)_1fr]">
          <section
            aria-labelledby="form-heading"
            className="grid content-start gap-5"
          >
            <div>
              <h2 id="form-heading" className="text-xl font-semibold">
                Dane do sprawdzenia
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Wystarczy jedna aktualna lokalizacja i co najmniej jeden objaw.
              </p>
            </div>

            <div className="grid gap-2">
              <label htmlFor="city-search" className="text-sm font-medium">
                Aktualne miasto
              </label>
              <div className="relative">
                <input
                  id="city-search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={isSuggestionsOpen}
                  aria-controls="city-suggestions"
                  value={cityQuery}
                  onBlur={handleCityBlur}
                  onChange={(event) => {
                    setCityQuery(event.target.value);
                    setIsSuggestionsOpen(true);
                  }}
                  onFocus={handleCityFocus}
                  placeholder="np. Warszawa"
                  className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />

                {isSuggestionsOpen && canSearch ? (
                  <div className="absolute z-20 mt-2 max-h-80 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                    <div
                      id="city-suggestions"
                      role="listbox"
                      className="max-h-64 overflow-y-auto py-1"
                    >
                      {citySearchStatus === "loading" ? (
                        <p className="px-3 py-3 text-sm text-slate-600">
                          Szukam miast...
                        </p>
                      ) : null}

                      {citySearchStatus !== "loading" &&
                      citySearchStatus === "unavailable" ? (
                        <p className="px-3 py-3 text-sm text-slate-600">
                          {citySearchMessage ||
                            "Sugestie miast są chwilowo niedostępne."}
                        </p>
                      ) : null}

                      {citySearchStatus !== "loading" &&
                      citySearchStatus !== "unavailable" &&
                      suggestions.length === 0 ? (
                        <p className="px-3 py-3 text-sm text-slate-600">
                          Brak pasujących sugestii.
                        </p>
                      ) : null}

                      {suggestions.map((suggestion) => {
                        const meta = formatSuggestionMeta(suggestion);

                        return (
                          <button
                            key={suggestion.placeId}
                            type="button"
                            role="option"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleCitySelect(suggestion)}
                            className="grid w-full gap-0.5 px-3 py-2 text-left hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
                          >
                            <span className="font-medium text-slate-950">
                              {suggestion.mainText}
                            </span>
                            <span className="text-sm text-slate-600">
                              {meta || suggestion.secondaryText || suggestion.label}
                              {suggestion.isPolandPriority ? " · Polska" : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <GoogleAttribution />
                  </div>
                ) : null}
              </div>
              <p className="min-h-5 text-sm text-slate-600">
                {selectedCity
                  ? `Wybrane miasto: ${selectedCity.label}`
                  : "Wpisz minimum 2 znaki, aby zobaczyć sugestie."}
              </p>
            </div>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Aktualne objawy</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {symptomCatalog.map((symptom) => {
                  const isSelected = selectedSymptomIds.includes(symptom.id);

                  return (
                    <label
                      key={symptom.id}
                      className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950"
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSymptom(symptom.id)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                      />
                      <span>{symptom.label}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Nasilenie objawów</legend>
              <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-300 bg-white p-1">
                {(["low", "high"] as const).map((option) => (
                  <label
                    key={option}
                    className={`flex h-10 cursor-pointer items-center justify-center rounded px-3 text-sm font-medium transition ${
                      intensity === option
                        ? "bg-slate-950 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name="intensity"
                      value={option}
                      checked={intensity === option}
                      onChange={() => setIntensity(option)}
                      className="sr-only"
                    />
                    {symptomIntensityLabels[option]}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section aria-labelledby="results-heading" className="grid gap-4">
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="results-heading" className="text-xl font-semibold">
                  Wyniki
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Pokazujemy wszystkie grupy alergenów z kontraktu MVP.
                </p>
              </div>
              {pollenStatus === "loading" ? (
                <p className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
                  Pobieram aktualną aktywność pyłków...
                </p>
              ) : null}
            </div>

            {!resultsReady ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-white px-5 py-8">
                <h3 className="text-lg font-semibold">
                  Uzupełnij dane, aby zobaczyć ranking
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Ranking pojawi się po wybraniu miasta, co najmniej jednego
                  objawu i poziomu nasilenia. Nie trzeba wysyłać formularza.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {pollenStatus === "unavailable" || hasUnknownPollen ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                    {pollenMessage ||
                      "Brak pełnych danych o aktualnej aktywności pyłków. Wyniki opierają się na objawach i dostępnych danych pyłkowych."}
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {rankedResults.map((result, index) => {
                    const explanation = formatResultExplanation(result.explanation);
                    const isTopResult = index === 0;

                    return (
                      <article
                        key={result.allergenId}
                        className={`rounded-md border p-4 shadow-sm ${
                          isTopResult
                            ? "border-emerald-500 bg-emerald-50 shadow-emerald-100"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            {isTopResult ? (
                              <p className="text-sm font-semibold uppercase tracking-normal text-emerald-800">
                                Najbardziej prawdopodobne
                              </p>
                            ) : null}
                            <h3 className="mt-1 text-lg font-semibold text-slate-950">
                              {result.allergenLabel}
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-sm font-medium text-emerald-950">
                              Prawdopodobieństwo: {result.likelihoodLabel}
                            </span>
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-800">
                              Pyłki: {result.pollenActivityLabel}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2">
                          <p className="text-sm font-medium text-slate-700">
                            Pasujące objawy
                          </p>
                          <p className="text-sm leading-6 text-slate-600">
                            {result.matchedSymptomLabels.length > 0
                              ? result.matchedSymptomLabels.join(", ")
                              : "Brak silnego dopasowania do wybranych objawów."}
                          </p>
                        </div>

                        {explanation ? (
                          <p className="mt-3 text-sm leading-6 text-slate-700">
                            {explanation}
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

          </section>
        </div>
      </div>
    </main>
  );
}
