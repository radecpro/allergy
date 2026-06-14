import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Route } from "./+types/home";
import { AccountNav } from "~/components/account-nav";
import { CityCombobox } from "~/components/city-combobox";
import { ModeSwitch } from "~/components/mode-switch";
import { SymptomCheckSave } from "~/components/symptom-check-save";
import { SymptomIntensitySelector } from "~/components/symptom-intensity-selector";
import {
  allergenIds,
  assignSymptomIntensity,
  deselectSymptom,
  getCompleteSymptomEntries,
  hasCompleteSymptomSelection,
  pollenActivityLabels,
  rankCurrentSymptomAllergens,
  selectSymptom,
  symptomCatalog,
} from "~/domain/allergen-ranking";
import type {
  CurrentSymptomSelection,
  PollenActivityByAllergen,
  SymptomId,
  SymptomIntensity,
} from "~/domain/allergen-ranking";
import type { CurrentPollenResponse } from "~/domain/current-location/http";
import type { CitySuggestion } from "~/domain/current-location/types";
import { createProductionSymptomCheckDependencies } from "~/domain/symptom-checks/dependencies.server";
import { buildCurrentSymptomSnapshot } from "~/domain/symptom-checks/snapshot";
import { createSaveSymptomCheckAction } from "~/domain/symptom-checks/symptom-check-route-handlers.server";

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

export async function action({ request }: Route.ActionArgs) {
  return createSaveSymptomCheckAction(
    createProductionSymptomCheckDependencies(),
  )(request);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export default function Home() {
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [symptomSelection, setSymptomSelection] =
    useState<CurrentSymptomSelection>([]);
  const [pollenActivity, setPollenActivity] =
    useState<PollenActivityByAllergen>(emptyPollenActivity);
  const [pollenStatus, setPollenStatus] = useState<AsyncStatus>("idle");
  const [pollenMessage, setPollenMessage] = useState("");
  const activePollenPlaceIdRef = useRef<string | null>(null);

  const completeSymptoms = useMemo(
    () => getCompleteSymptomEntries(symptomSelection),
    [symptomSelection],
  );
  const resultsReady = selectedCity !== null && completeSymptoms.length > 0;
  const saveReady =
    selectedCity !== null && hasCompleteSymptomSelection(symptomSelection);
  const hasUnknownPollen = allergenIds.some(
    (allergenId) => pollenActivity[allergenId] === "unknown",
  );

  const rankedResults = useMemo(() => {
    if (!resultsReady) {
      return [];
    }

    return rankCurrentSymptomAllergens({
      symptoms: completeSymptoms,
      pollenActivity,
    });
  }, [completeSymptoms, pollenActivity, resultsReady]);
  const saveSnapshot = useMemo(() => {
    if (!saveReady || !selectedCity) {
      return null;
    }

    return buildCurrentSymptomSnapshot({
      city: {
        placeId: selectedCity.placeId,
        label: selectedCity.label,
      },
      symptoms: completeSymptoms,
      pollenActivity,
    });
  }, [
    completeSymptoms,
    pollenActivity,
    saveReady,
    selectedCity,
  ]);

  useEffect(() => {
    if (selectedCity === null) {
      return;
    }

    const controller = new AbortController();
    setPollenStatus("loading");
    setPollenMessage("");
    setPollenActivity(emptyPollenActivity);

    fetch("/api/current-pollen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ placeId: selectedCity.placeId }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as CurrentPollenResponse;

        if (activePollenPlaceIdRef.current !== selectedCity.placeId) {
          return;
        }

        setPollenActivity(payload.pollenActivity);
        setPollenStatus(payload.status === "ok" ? "idle" : "unavailable");
        setPollenMessage(payload.message ?? "");
      })
      .catch((error: unknown) => {
        if (
          !isAbortError(error) &&
          activePollenPlaceIdRef.current === selectedCity.placeId
        ) {
          setPollenActivity(emptyPollenActivity);
          setPollenStatus("unavailable");
          setPollenMessage("Aktualne dane pyłkowe są chwilowo niedostępne.");
        }
      });

    return () => controller.abort();
  }, [selectedCity]);

  const handleCitySelect = useCallback((city: CitySuggestion | null) => {
    activePollenPlaceIdRef.current = city?.placeId ?? null;
    setSelectedCity(city);
    setPollenActivity(emptyPollenActivity);
    setPollenMessage("");

    if (city === null) {
      setPollenStatus("idle");
    } else {
      setPollenStatus("loading");
    }
  }, []);

  function toggleSymptom(symptomId: SymptomId) {
    setSymptomSelection((current) =>
      current.some((symptom) => symptom.symptomId === symptomId)
        ? deselectSymptom(current, symptomId)
        : selectSymptom(current, symptomId),
    );
  }

  function handleIntensityAssign(
    symptomId: SymptomId,
    intensity: SymptomIntensity,
  ) {
    setSymptomSelection((current) =>
      assignSymptomIntensity(current, symptomId, intensity),
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid gap-3 border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
              Allergen Finder
            </p>
            <AccountNav />
          </div>
          <ModeSwitch />
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
              To nie jest diagnoza medyczna. Aplikacja nie zapisuje lokalizacji
              ani objawów automatycznie. Historia powstaje tylko po wybraniu
              opcji zapisu.
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

            <CityCombobox
              selectedCity={selectedCity}
              onSelect={handleCitySelect}
              inputId="city-search"
              listboxId="city-suggestions"
              label="Aktualne miasto"
              helperText="Wpisz minimum 2 znaki, aby zobaczyć sugestie."
              placeholder="np. Warszawa"
            />

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Aktualne objawy</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {symptomCatalog.map((symptom) => {
                  const selectedSymptom = symptomSelection.find(
                    (selected) => selected.symptomId === symptom.id,
                  );
                  const isSelected = selectedSymptom !== undefined;

                  return (
                    <div
                      key={symptom.id}
                      className={`overflow-hidden rounded-md border text-sm transition ${
                        isSelected
                          ? "border-emerald-600 bg-white text-slate-950"
                          : "border-slate-300 bg-white text-slate-800 hover:border-slate-400"
                      }`}
                    >
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSymptom(symptom.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span className="font-medium">{symptom.label}</span>
                      </label>

                      {selectedSymptom ? (
                        <SymptomIntensitySelector
                          symptomId={selectedSymptom.symptomId}
                          symptomLabel={symptom.label}
                          intensity={selectedSymptom.intensity}
                          onAssign={handleIntensityAssign}
                        />
                      ) : null}
                    </div>
                  );
                })}
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
                  objawu i nasilenia dla każdego objawu. Nie trzeba wysyłać
                  formularza.
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
                            <span
                              className={`rounded-md px-2.5 py-1 text-sm font-medium ${
                                result.pollenActivity === "unknown"
                                  ? "bg-amber-100 text-amber-950"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              Aktywność pyłków: {result.pollenActivityLabel}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2">
                          <p className="text-sm font-medium text-slate-700">
                            Pasujące objawy
                          </p>
                          {result.matchedSymptoms.length > 0 ? (
                            <ul className="flex flex-wrap gap-2 text-sm text-slate-700">
                              {result.matchedSymptoms.map((symptom) => (
                                <li
                                  key={symptom.symptomId}
                                  className="rounded-md bg-slate-100 px-2.5 py-1"
                                >
                                  {symptom.label}: {symptom.intensityLabel}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm leading-6 text-slate-600">
                              Brak silnego dopasowania do wybranych objawów.
                            </p>
                          )}
                        </div>

                      </article>
                    );
                  })}
                </div>
              </div>
            )}

          </section>
        </div>

        <SymptomCheckSave
          snapshot={saveSnapshot}
          disabled={pollenStatus === "loading"}
        />
      </div>
    </main>
  );
}
