import { useCallback, useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/destination-search";
import { CityCombobox } from "~/components/city-combobox";
import { ModeSwitch } from "~/components/mode-switch";
import {
  allergenIds,
  summarizeDestinationPollenActivity,
} from "~/domain/allergen-ranking";
import type {
  DestinationPollenActivitySummary,
  PollenActivityByAllergen,
} from "~/domain/allergen-ranking";
import type { CurrentPollenResponse } from "~/domain/current-location/http";
import type { CitySuggestion } from "~/domain/current-location/types";

const emptyPollenActivity = Object.fromEntries(
  allergenIds.map((allergenId) => [allergenId, "unknown"]),
) as PollenActivityByAllergen;

type AsyncStatus = "idle" | "loading" | "unavailable";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Allergen Finder | Podróż" },
    {
      name: "description",
      content:
        "Sprawdź aktualną aktywność pyłków i kontekst środowiskowy dla miasta docelowego.",
    },
  ];
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function activityBadgeClass(
  activity: DestinationPollenActivitySummary["pollenActivity"],
): string {
  if (activity === "high" || activity === "very-high") {
    return "bg-rose-100 text-rose-950";
  }

  if (activity === "moderate") {
    return "bg-amber-100 text-amber-950";
  }

  if (activity === "low") {
    return "bg-emerald-100 text-emerald-950";
  }

  return "bg-slate-100 text-slate-800";
}

function DestinationCard({
  summary,
}: {
  summary: DestinationPollenActivitySummary;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-950">
          {summary.allergenLabel}
        </h3>
        <span
          className={`w-fit rounded-md px-2.5 py-1 text-sm font-medium ${activityBadgeClass(summary.pollenActivity)}`}
        >
          Aktywność pyłków: {summary.pollenActivityLabel}
        </span>
      </div>
      <div className="mt-3 grid gap-1">
        <p className="text-sm font-medium text-slate-700">
          Możliwe objawy przy ekspozycji
        </p>
        <p className="text-sm leading-6 text-slate-600">
          {summary.possibleSymptomLabels.join(", ")}
        </p>
      </div>
    </article>
  );
}

export default function DestinationSearch() {
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [pollenActivity, setPollenActivity] =
    useState<PollenActivityByAllergen>(emptyPollenActivity);
  const [pollenStatus, setPollenStatus] = useState<AsyncStatus>("idle");
  const [pollenMessage, setPollenMessage] = useState("");

  const destinationSummaries = useMemo(
    () => summarizeDestinationPollenActivity({ pollenActivity }),
    [pollenActivity],
  );
  const hasUnknownPollen = destinationSummaries.some(
    (summary) => summary.pollenActivity === "unknown",
  );

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
          setPollenMessage(
            "Dane o aktywności pyłków dla miejsca docelowego są chwilowo niedostępne.",
          );
        }
      });

    return () => controller.abort();
  }, [selectedCity]);

  const handleCitySelect = useCallback((city: CitySuggestion | null) => {
    setSelectedCity(city);

    if (city === null) {
      setPollenActivity(emptyPollenActivity);
      setPollenStatus("idle");
      setPollenMessage("");
    }
  }, []);

  return (
    <main className="min-h-screen bg-stone-50 text-slate-950">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid gap-3 border-b border-slate-200 pb-5">
          <p className="text-sm font-semibold uppercase tracking-normal text-emerald-700">
            Allergen Finder
          </p>
          <ModeSwitch />
          <div className="grid gap-3 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-slate-950 sm:text-4xl">
                Sprawdź aktywność pyłków przed podróżą
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Wybierz miasto docelowe, aby zobaczyć aktualny kontekst
                środowiskowy dla wszystkich grup alergenów w aplikacji.
              </p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              Wyniki opisują środowisko w miejscu docelowym. Nie są diagnozą
              ani oceną osobistego ryzyka objawów.
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,25rem)_1fr]">
          <section
            aria-labelledby="destination-form-heading"
            className="grid content-start gap-5"
          >
            <div>
              <h2 id="destination-form-heading" className="text-xl font-semibold">
                Miejsce docelowe
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Wyszukaj miasto, do którego planujesz podróż.
              </p>
            </div>

            <CityCombobox
              selectedCity={selectedCity}
              onSelect={handleCitySelect}
              inputId="destination-city-search"
              listboxId="destination-city-suggestions"
              label="Miasto docelowe"
              helperText="Wpisz minimum 2 znaki, aby zobaczyć sugestie."
              placeholder="np. Barcelona"
            />
          </section>

          <section
            aria-labelledby="destination-results-heading"
            className="grid content-start gap-4"
          >
            <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2
                  id="destination-results-heading"
                  className="text-xl font-semibold"
                >
                  Aktywność pyłków
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Wszystkie grupy są pokazane bez rankingu osobistego ryzyka.
                </p>
              </div>
              {pollenStatus === "loading" ? (
                <p
                  role="status"
                  className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900"
                >
                  Pobieram dane dla miejsca docelowego...
                </p>
              ) : null}
            </div>

            {selectedCity === null ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-white px-5 py-8">
                <h3 className="text-lg font-semibold">
                  Wybierz miasto docelowe
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  Po wybraniu miasta pokażemy aktywność pyłków i krótki kontekst
                  środowiskowy. Nie musisz podawać objawów.
                </p>
              </div>
            ) : pollenStatus === "loading" ? (
              <div className="rounded-md border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600">
                Przygotowuję informacje o aktywności pyłków dla miasta{" "}
                <span className="font-medium text-slate-900">
                  {selectedCity.label}
                </span>
                .
              </div>
            ) : (
              <div className="grid gap-4">
                {pollenStatus === "unavailable" || hasUnknownPollen ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                    {pollenMessage ||
                      "Część danych o aktywności pyłków dla miejsca docelowego jest niedostępna. Wszystkie grupy pozostają widoczne jako kontekst środowiskowy."}
                  </div>
                ) : null}

                <div className="grid gap-3">
                  {destinationSummaries.map((summary) => (
                    <DestinationCard
                      key={summary.allergenId}
                      summary={summary}
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
