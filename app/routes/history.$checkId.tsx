import { useEffect, useState } from "react";
import {
  isRouteErrorResponse,
  Form,
  Link,
  useActionData,
  useNavigation,
  useLoaderData,
  useSearchParams,
} from "react-router";

import { AccountNav } from "~/components/account-nav";
import { SymptomCheckSummary } from "~/components/symptom-check-summary";
import { SymptomIntensitySelector } from "~/components/symptom-intensity-selector";
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

function getSymptomLabel(symptomId: string) {
  return symptomCatalog.find((symptom) => symptom.id === symptomId)?.label ?? symptomId;
}

export default function SavedSymptomCheck() {
  const data = useLoaderData() as SymptomCheckDetailLoaderData;
  const actionData = useActionData() as SymptomCheckDetailActionData | undefined;
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deletePromptOpen, setDeletePromptOpen] = useState(false);
  const [editState, setEditState] = useState(() =>
    initializeSavedCheckEditState(data.record.snapshot.symptoms),
  );

  const isSubmitting = navigation.state !== "idle";
  const pendingIntent = navigation.formData?.get("intent");
  const draftEntries = getSavedCheckEditSubmissionEntries(editState);
  const draftComplete = hasCompleteSavedCheckEditState(editState);
  const draftDirty = isSavedCheckEditStateDirty(editState);
  const previewResults = draftComplete
    ? reconstructSymptomCheck({
        ...data.record.snapshot,
        symptoms: draftEntries,
      }).rankedResults
    : [];
  const errorMessage = actionData?.error ?? null;
  const canSave = isEditing && draftComplete && draftDirty && !isSubmitting && !deletePromptOpen;
  const formDisabled = isSubmitting || deletePromptOpen;

  useEffect(() => {
    setEditState(initializeSavedCheckEditState(data.record.snapshot.symptoms));
    setIsEditing(false);
    setDeletePromptOpen(false);
    setFlashMessage(null);
  }, [data.record.id, data.record.snapshot.symptoms]);

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
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    url.searchParams.delete("requestId");
    url.searchParams.delete("updated");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}`,
    );
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
    <main className="min-h-screen bg-stone-50 px-4 py-6 text-slate-950">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-700">
              Allergen Finder
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Zapisane sprawdzenie
            </h1>
          </div>
          <AccountNav />
        </header>

        {flashMessage ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            {flashMessage}
          </p>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <SymptomCheckSummary snapshot={data.record.snapshot} />
        </section>

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
                <button
                  type="button"
                  onClick={handleStartEdit}
                  disabled={isSubmitting}
                  className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Edytuj
                </button>
                <button
                  type="button"
                  onClick={handleOpenDeletePrompt}
                  disabled={isSubmitting}
                  className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Usuń zapis
                </button>
              </div>
            </div>
            {reconstructSymptomCheck(data.record.snapshot).rankedResults.map(
              (result, index) => (
                <article
                  key={result.allergenId}
                  className={`rounded-md border p-4 ${
                    index === 0
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {index === 0 ? (
                    <p className="text-xs font-semibold uppercase text-emerald-800">
                      Najwyżej w rankingu
                    </p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">
                      {result.allergenLabel}
                    </h3>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-emerald-950">
                        Prawdopodobieństwo: {result.likelihoodLabel}
                      </span>
                      <span
                        className={`rounded-md px-2.5 py-1 ${
                          result.pollenActivity === "unknown"
                            ? "bg-amber-100 text-amber-950"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        Aktywność pyłków: {result.pollenActivityLabel}
                      </span>
                    </div>
                  </div>
                  {result.matchedSymptoms.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      <p className="text-sm font-medium text-slate-700">
                        Pasujące objawy
                      </p>
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
                    </div>
                  ) : null}
                </article>
              ),
            )}
          </section>
        ) : (
          <section className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Edytuj zapis</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Zmieniasz tylko objawy i ich nasilenie. Lokalizacja i pyłki
                  pozostają bez zmian.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  form="saved-check-update-form"
                  disabled={!canSave}
                  className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingIntent === "update" ? "Zapisuję..." : "Zapisz zmiany"}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                {errorMessage}
              </p>
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
                      <article
                        key={symptom.id}
                        className={`grid rounded-md border ${
                          selected
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <label className="flex items-start gap-3 p-3 text-sm font-medium text-slate-900">
                          <input
                            type="checkbox"
                            checked={Boolean(selected)}
                            onChange={(event) =>
                              handleToggleSymptom(
                                symptom.id,
                                event.currentTarget.checked,
                              )
                            }
                            disabled={formDisabled}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-700"
                          />
                          <span>{symptom.label}</span>
                        </label>

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
                        ) : (
                          <p className="border-t border-dashed border-slate-200 px-3 pb-3 pt-2 text-xs leading-5 text-slate-600">
                            Wybierz objaw, aby dodać go do zapisu.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </Form>

              <div className="grid gap-4">
                <section className="rounded-md border border-emerald-300 bg-emerald-50 p-4">
                  <h3 className="text-lg font-semibold text-emerald-950">
                    Niezapisany podgląd rankingu
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-emerald-900">
                    Podgląd pokazuje, co zostanie zapisane przy obecnym wyborze.
                  </p>
                  {draftComplete ? (
                    <div className="mt-3 grid gap-3">
                      {previewResults.map((result, index) => (
                        <article
                          key={result.allergenId}
                          className={`rounded-md border p-4 ${
                            index === 0
                              ? "border-emerald-400 bg-white"
                              : "border-emerald-200 bg-white"
                          }`}
                        >
                          {index === 0 ? (
                            <p className="text-xs font-semibold uppercase text-emerald-800">
                              Najwyżej w podglądzie
                            </p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
                            <h4 className="text-base font-semibold">
                              {result.allergenLabel}
                            </h4>
                            <div className="flex flex-wrap gap-2 text-sm">
                              <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-emerald-950">
                                Prawdopodobieństwo: {result.likelihoodLabel}
                              </span>
                              <span
                                className={`rounded-md px-2.5 py-1 ${
                                  result.pollenActivity === "unknown"
                                    ? "bg-amber-100 text-amber-950"
                                    : "bg-slate-100 text-slate-800"
                                }`}
                              >
                                Aktywność pyłków: {result.pollenActivityLabel}
                              </span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-md border border-dashed border-emerald-200 bg-white px-4 py-3 text-sm leading-6 text-emerald-950">
                      Uzupełnij wszystkie wybrane objawy, aby zobaczyć pełny
                      podgląd.
                    </p>
                  )}
                </section>

              </div>
            </div>
          </section>
        )}

        <section className="rounded-md border border-rose-200 bg-rose-50 p-4">
          {!deletePromptOpen ? (
            <div className="grid gap-3">
              <div>
                <h3 className="text-lg font-semibold text-rose-950">
                  Usuń zapis
                </h3>
                <p className="mt-1 text-sm leading-6 text-rose-900">
                  Usunięcie jest trwałe i nie można go cofnąć.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenDeletePrompt}
                disabled={isSubmitting}
                className="rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-900 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Usuń zapis
              </button>
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
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleCancelDeletePrompt}
                  disabled={isSubmitting}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pendingIntent === "delete"
                    ? "Usuwam..."
                    : "Potwierdź usunięcie"}
                </button>
              </div>
            </Form>
          )}
        </section>

        {!isEditing ? (
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              to="/history"
              className="font-medium text-emerald-800 underline underline-offset-4"
            >
              Wróć do historii
            </Link>
            <Link
              to="/"
              className="font-medium text-emerald-800 underline underline-offset-4"
            >
              Wykonaj nowe sprawdzenie
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              to="/history"
              className="font-medium text-emerald-800 underline underline-offset-4"
            >
              Wróć do historii
            </Link>
          </div>
        )}
      </div>
    </main>
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
