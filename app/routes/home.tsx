import { useCallback, useEffect, useMemo, useState } from "react";
import type { Route } from "./+types/home";
import { AppShell } from "~/components/app-shell";
import { CityCombobox } from "~/components/city-combobox";
import { CurrentLocationControl } from "~/components/current-location-control";
import { EmptyState } from "~/components/empty-state";
import { ModeSwitch } from "~/components/mode-switch";
import { Notice } from "~/components/notice";
import { RankingResultCard } from "~/components/ranking-result-card";
import { SymptomCheckSave } from "~/components/symptom-check-save";
import { SymptomIntensitySelector } from "~/components/symptom-intensity-selector";
import { SymptomSelectionCard } from "~/components/symptom-selection-card";
import {
  allergenIds,
  assignSymptomIntensity,
  deselectSymptom,
  getCompleteSymptomEntries,
  hasCompleteSymptomSelection,
  rankCurrentSymptomAllergens,
  selectSymptom,
  symptomCatalog,
} from "~/domain/allergen-ranking";
import type {
  CurrentSymptomSelection,
  SymptomId,
  SymptomIntensity,
} from "~/domain/allergen-ranking";
import {
  createCurrentPollenLookup,
  idleCurrentPollenState,
} from "~/domain/current-location/current-pollen";
import type { CitySuggestion } from "~/domain/current-location/types";
import { createProductionSymptomCheckDependencies } from "~/domain/symptom-checks/dependencies.server";
import { buildCurrentSymptomSnapshot } from "~/domain/symptom-checks/snapshot";
import { createSaveSymptomCheckAction } from "~/domain/symptom-checks/symptom-check-route-handlers.server";

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
  const [{ pollenActivity, status: pollenStatus, message: pollenMessage }, setPollenState] =
    useState(idleCurrentPollenState);

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
    const lookup = createCurrentPollenLookup({
      fetchCurrentPollen: fetch,
      onState: setPollenState,
      unavailableMessage: "Aktualne dane pyłkowe są chwilowo niedostępne.",
    });

    lookup.setCity(selectedCity);

    return () => lookup.dispose();
  }, [selectedCity]);

  const handleCitySelect = useCallback((city: CitySuggestion | null) => {
    setSelectedCity(city);
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
    <AppShell
      title="Sprawdź, które pyłki mogą dziś pasować do Twoich objawów"
      description="Wybierz miasto, zaznacz objawy i poziom nasilenia. Wyniki aktualizują się automatycznie i pokazują kontekst orientacyjny."
      headerAction={<ModeSwitch />}
      notice="To nie jest diagnoza medyczna. Aplikacja nie zapisuje lokalizacji ani objawów automatycznie. Historia powstaje tylko po wybraniu opcji zapisu."
    >
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

            <div className="grid gap-3">
              <CityCombobox
                selectedCity={selectedCity}
                onSelect={handleCitySelect}
                inputId="city-search"
                listboxId="city-suggestions"
                label="Aktualne miasto"
                helperText="Wpisz minimum 2 znaki, aby zobaczyć sugestie."
                placeholder="np. Warszawa"
              />
              <CurrentLocationControl onResolve={handleCitySelect} />
            </div>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Aktualne objawy</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {symptomCatalog.map((symptom) => {
                  const selectedSymptom = symptomSelection.find(
                    (selected) => selected.symptomId === symptom.id,
                  );
                  const isSelected = selectedSymptom !== undefined;

                  return (
                    <SymptomSelectionCard
                      key={symptom.id}
                      label={symptom.label}
                      selected={isSelected}
                      onChange={() => toggleSymptom(symptom.id)}
                    >
                      {selectedSymptom ? (
                        <SymptomIntensitySelector
                          symptomId={selectedSymptom.symptomId}
                          symptomLabel={symptom.label}
                          intensity={selectedSymptom.intensity}
                          onAssign={handleIntensityAssign}
                        />
                      ) : null}
                    </SymptomSelectionCard>
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
                <Notice role="status" tone="info" className="border-sky-100 py-2">
                  Pobieram aktualną aktywność pyłków...
                </Notice>
              ) : null}
            </div>

            {!resultsReady ? (
              <EmptyState title="Uzupełnij dane, aby zobaczyć ranking">
                  Ranking pojawi się po wybraniu miasta, co najmniej jednego
                  objawu i jego nasilenia.
              </EmptyState>
            ) : (
              <div className="grid gap-4">
                {pollenStatus === "unavailable" || hasUnknownPollen ? (
                  <Notice tone="warning">
                    {pollenMessage ||
                      "Brak pełnych danych o aktualnej aktywności pyłków. Wyniki opierają się na objawach i dostępnych danych pyłkowych."}
                  </Notice>
                ) : null}

                <div className="grid gap-3">
                  {rankedResults.map((result, index) => (
                    <RankingResultCard
                      key={result.allergenId}
                      result={result}
                      isTopResult={index === 0}
                    />
                  ))}
                </div>
              </div>
            )}

            <SymptomCheckSave
              snapshot={saveSnapshot}
              disabled={pollenStatus === "loading"}
            />
          </section>
        </div>
    </AppShell>
  );
}
