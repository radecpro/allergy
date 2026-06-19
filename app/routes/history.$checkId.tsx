import { useEffect, useMemo, useState } from "react";
import {
  isRouteErrorResponse,
  Form,
  Link,
  useActionData,
  useNavigation,
  useLoaderData,
  useSearchParams,
} from "react-router";

import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/button";
import { Notice } from "~/components/notice";
import { Panel } from "~/components/panel";
import { RankingResultCard } from "~/components/ranking-result-card";
import { SymptomCheckSummary } from "~/components/symptom-check-summary";
import { SymptomIntensitySelector } from "~/components/symptom-intensity-selector";
import { SymptomSelectionCard } from "~/components/symptom-selection-card";
import { TextLink } from "~/components/text-link";
import {
  symptomCatalog,
  type SymptomId,
  type SymptomIntensity,
} from "~/domain/allergen-ranking";
import { clearPendingSymptomCheck } from "~/domain/symptom-checks/pending-snapshot";
import {
  assignSavedCheckSymptomIntensity,
  deselectSavedCheckSymptom,
  getSavedCheckEditSubmissionEntries,
  hasCompleteSavedCheckEditState,
  initializeSavedCheckEditState,
  isSavedCheckEditStateDirty,
  resetSavedCheckEditState,
  selectSavedCheckSymptom,
} from "~/domain/symptom-checks/saved-check-edit-state";
import { reconstructSymptomCheck } from "~/domain/symptom-checks/snapshot";
import { createProductionSymptomCheckDependencies } from "~/domain/symptom-checks/dependencies.server";
import {
  createSymptomCheckDetailAction,
  createSymptomCheckDetailLoader,
} from "~/domain/symptom-checks/symptom-check-route-handlers.server";
import type {
  SymptomCheckDetailActionData,
  SymptomCheckDetailLoaderData,
} from "~/domain/symptom-checks/symptom-check-route-handlers.server";

import type { Route } from "./+types/history.$checkId";

export function meta() {
  return [{ title: "Allergen Finder | Zapisane sprawdzenie" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  return createSymptomCheckDetailLoader(
    createProductionSymptomCheckDependencies(),
  )(request, params.checkId);
}

export async function action({ request, params }: Route.ActionArgs) {
  return createSymptomCheckDetailAction(
    createProductionSymptomCheckDependencies(),
  )(request, params.checkId);
}

export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
  return {
    "Cache-Control":
      errorHeaders?.get("Cache-Control") ??
      loaderHeaders.get("Cache-Control") ??
      "private, no-store",
  };
}

export default function SavedSymptomCheck() {
  const data = useLoaderData() as SymptomCheckDetailLoaderData;
  const actionData = useActionData() as SymptomCheckDetailActionData | undefined;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [editState, setEditState] = useState(() =>
    initializeSavedCheckEditState(data.record.snapshot.symptoms),
  );
  const [previewResults, setPreviewResults] = useState(() =>
    reconstructSymptomCheck(data.record.snapshot).rankedResults,
  );

  const isSubmitting = navigation.state !== "idle";
  const pendingIntent = navigation.formData?.get("intent");
  const draftEntries = getSavedCheckEditSubmissionEntries(editState);
  const draftComplete = hasCompleteSavedCheckEditState(editState);
  const draftDirty = isSavedCheckEditStateDirty(editState);
  const nextPreviewResults = useMemo(
    () =>
      draftComplete
        ? reconstructSymptomCheck({
            ...data.record.snapshot,
            symptoms: getSavedCheckEditSubmissionEntries(editState),
          }).rankedResults
        : [],
    [data.record.snapshot, draftComplete, editState],
  );
  const errorMessage = actionData?.error ?? null;
  const canSave = isEditing && draftComplete && draftDirty && !isSubmitting && !deletePromptOpen;
  const formDisabled = isSubmitting || deletePromptOpen;

  useEffect(() => {
    setEditState(initializeSavedCheckEditState(data.record.snapshot.symptoms));
    setIsEditing(false);
    setDeletePromptOpen(false);
    setFlashMessage(null);
    setPreviewResults(reconstructSymptomCheck(data.record.snapshot).rankedResults);
  }, [data.record.id, data.record.updatedAt, data.record.snapshot.symptoms]);

  useEffect(() => {
    if (draftComplete) {
      setPreviewResults(nextPreviewResults);
    }
  }, [draftComplete, nextPreviewResults]);

  useEffect(() => {
    const saved = searchParams.get("saved") === "1";
    const updated = searchParams.get("updated") === "1";

    if (!saved && !updated) {
      return;
    }

    if (saved) {
      setFlashMessage("Sprawdzenie zostało zapisane.");

      if (data.requestId) {
        clearPendingSymptomCheck(window.sessionStorage, data.requestId);
      }
    }

    if (updated) {
      setFlashMessage("Zmiany w zapisanym sprawdzeniu zostały zapisane.");
      setIsEditing(false);
      setDeletePromptOpen(false);
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("saved");
    nextSearchParams.delete("requestId");
    nextSearchParams.delete("updated");
    setSearchParams(nextSearchParams, { replace: true });
  }, [data.requestId, searchParams]);

  function handleStartEdit() {
    setIsEditing(true);
    setDeletePromptOpen(false);
  }

  function handleCancelEdit() {
    setEditState((state) => resetSavedCheckEditState(state));
    setIsEditing(false);
  }

  function handleOpenDeletePrompt() {
    setDeletePromptOpen(true);
    setIsEditing(false);
  }

  function handleCancelDeletePrompt() {
    setDeletePromptOpen(false);
  }

  function handleToggleSymptom(symptomId: SymptomId, checked: boolean) {
    setEditState((state) =>
      checked
        ? selectSavedCheckSymptom(state, symptomId)
        : deselectSavedCheckSymptom(state, symptomId),
    );
  }

  function handleAssignIntensity(
    symptomId: SymptomId,
    intensity: SymptomIntensity,
  ) {
    setEditState((state) =>
      assignSavedCheckSymptomIntensity(state, symptomId, intensity),
    );
  }

  return (
    <AppShell
      title="Zapisane sprawdzenie"
      description="Przeglądaj zapisany ranking albo popraw objawy i ich nasilenie."
      headerAction={
        <TextLink to="/history" className="w-fit">
          Wróć do historii
        </TextLink>
      }
    >

        {flashMessage ? (
          <Notice tone="success" role="status">{flashMessage}</Notice>
        ) : null}

        <Panel>
          <SymptomCheckSummary snapshot={data.record.snapshot} />
        </Panel>

        {!isEditing ? (
          <section className="grid gap-3" aria-labelledby="saved-results-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="saved-results-heading" className="text-xl font-semibold">
                  Zapisany ranking
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Wynik jest orientacyjny i nie stanowi diagnozy medycznej.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleStartEdit}
                  disabled={isSubmitting}
                  tone="secondary"
                  className="border-emerald-300 text-emerald-900 hover:bg-emerald-50"
                >
                  Edytuj
                </Button>
              </div>
            </div>
            {reconstructSymptomCheck(data.record.snapshot).rankedResults.map(
              (result, index) => (
                <RankingResultCard
                  key={result.allergenId}
                  result={result}
                  isTopResult={index === 0}
                  topLabel="Najwyżej w rankingu"
                />
              ),
            )}
          </section>
        ) : (
          <Panel className="grid gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Edytuj zapis</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Zmieniasz tylko objawy i ich nasilenie. Lokalizacja i pyłki
                  pozostają bez zmian.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  tone="secondary"
                >
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  form="saved-check-update-form"
                  disabled={!canSave}
                >
                  {pendingIntent === "update" ? "Zapisuję..." : "Zapisz zmiany"}
                </Button>
              </div>
            </div>

            {errorMessage ? (
              <Notice role="alert" tone="error">{errorMessage}</Notice>
            ) : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <Form
                id="saved-check-update-form"
                method="post"
                className="grid gap-4"
              >
                <input type="hidden" name="intent" value="update" />
                <input
                  type="hidden"
                  name="symptoms"
                  value={JSON.stringify(draftEntries)}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {symptomCatalog.map((symptom) => {
                    const selected = editState.draft.find(
                      (entry) => entry.symptomId === symptom.id,
                    );

                    return (
                      <SymptomSelectionCard
                        key={symptom.id}
                        label={symptom.label}
                        selected={Boolean(selected)}
                        disabled={formDisabled}
                        onChange={(checked) =>
                          handleToggleSymptom(symptom.id, checked)
                        }
                        helper="Wybierz objaw, aby dodać go do zapisu."
                      >
                        {selected ? (
                          <SymptomIntensitySelector
                            symptomId={symptom.id}
                            symptomLabel={symptom.label}
                            intensity={selected.intensity}
                            onAssign={(_, intensity) =>
                              handleAssignIntensity(symptom.id, intensity)
                            }
                            disabled={formDisabled}
                          />
                        ) : null}
                      </SymptomSelectionCard>
                    );
                  })}
                </div>
              </Form>

              <div className="grid gap-4">
                <Panel tone="highlight" className="p-4">
                  <h3 className="text-lg font-semibold text-emerald-950">
                    Niezapisany podgląd rankingu
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">
                    Podgląd pokazuje, co zostanie zapisane przy obecnym wyborze.
                  </p>
                  <div className="mt-3 grid gap-3">
                    {previewResults.map((result, index) => (
                      <RankingResultCard
                        key={result.allergenId}
                        result={result}
                        isTopResult={index === 0}
                        topLabel="Najwyżej w podglądzie"
                        headingLevel="h4"
                      />
                    ))}
                  </div>
                  {draftComplete ? null : (
                    <Notice tone="success" className="mt-3 border-dashed bg-white text-emerald-950">
                      Uzupełnij wszystkie wybrane objawy, aby odświeżyć
                      ranking. Ostatni pełny podgląd pozostaje widoczny.
                    </Notice>
                  )}
                </Panel>

              </div>
            </div>
          </Panel>
        )}

        <Panel tone="danger" className="p-4">
          {!deletePromptOpen ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-rose-950">
                  Usuń zapis
                </h3>
                <p className="mt-1 text-sm leading-6 text-rose-900">
                  Usunięcie jest trwałe i nie można go cofnąć.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleOpenDeletePrompt}
                disabled={isSubmitting}
                tone="ghost-danger"
                className="hover:bg-rose-100"
              >
                Usuń zapis
              </Button>
            </div>
          ) : (
            <Form method="post" className="grid gap-3">
              <input type="hidden" name="intent" value="delete" />
              <div>
                <h3 className="text-lg font-semibold text-rose-950">
                  Potwierdź usunięcie
                </h3>
                <p className="mt-1 text-sm leading-6 text-rose-900">
                  To usunie ten zapis na stałe. Lokalizacja, pyłki i historia
                  nie będą już dostępne.
                </p>
              </div>
              {errorMessage ? (
                <Notice role="alert" tone="error" className="bg-white">
                  {errorMessage}
                </Notice>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={handleCancelDeletePrompt}
                  disabled={isSubmitting}
                  tone="secondary"
                >
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  tone="danger"
                >
                  {pendingIntent === "delete"
                    ? "Usuwam..."
                    : "Potwierdź usunięcie"}
                </Button>
              </div>
            </Form>
          )}
        </Panel>

        {!isEditing ? (
          <div className="flex flex-wrap gap-4 text-sm">
            <TextLink to="/history">
              Wróć do historii
            </TextLink>
            <TextLink to="/">
              Wykonaj nowe sprawdzenie
            </TextLink>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            <TextLink to="/history">
              Wróć do historii
            </TextLink>
          </div>
        )}
    </AppShell>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-12 text-slate-950">
      <div className="mx-auto grid w-full max-w-lg gap-4 rounded-md border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold uppercase text-emerald-700">
          Allergen Finder
        </p>
        <h1 className="text-2xl font-semibold">
          {notFound
            ? "Nie znaleziono zapisanego sprawdzenia"
            : "Nie udało się otworzyć sprawdzenia"}
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          {notFound
            ? "Rekord nie istnieje albo nie należy do zalogowanego konta."
            : "Spróbuj ponownie później."}
        </p>
        <Link
          to="/"
          className="text-sm font-medium text-emerald-800 underline underline-offset-4"
        >
          Wróć do nowego sprawdzenia
        </Link>
      </div>
    </main>
  );
}
