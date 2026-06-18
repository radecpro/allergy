import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";

import { AccountNav } from "~/components/account-nav";
import { SymptomCheckSummary } from "~/components/symptom-check-summary";
import { createProductionSymptomCheckDependencies } from "~/domain/symptom-checks/dependencies.server";
import { reconstructSymptomCheck } from "~/domain/symptom-checks/snapshot";
import {
  createSymptomCheckListLoader,
} from "~/domain/symptom-checks/symptom-check-route-handlers.server";
import type { SymptomCheckListLoaderData } from "~/domain/symptom-checks/symptom-check-route-handlers.server";

import type { Route } from "./+types/history";

export function meta() {
  return [{ title: "Allergen Finder | Historia sprawdzeń" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  return createSymptomCheckListLoader(
    createProductionSymptomCheckDependencies(),
  )(request);
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return {
    "Cache-Control":
      loaderHeaders.get("Cache-Control") ?? "private, no-store",
  };
}

export default function SymptomCheckHistory() {
  const data = useLoaderData() as SymptomCheckListLoaderData;
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [deletePromptRecordId, setDeletePromptRecordId] = useState<string | null>(
    null,
  );
  const deletionFlashShownRef = useRef(false);
  const isSubmitting = navigation.state !== "idle";
  const pendingIntent = navigation.formData?.get("intent");

  useEffect(() => {
    const deleted = searchParams.get("deleted") === "1";

    if (!deleted) {
      return;
    }

    if (!deletionFlashShownRef.current) {
      setFlashMessage("Sprawdzenie zostało usunięte.");
      deletionFlashShownRef.current = true;
    }

    const nextSearchParams = new URLSearchParams(searchParams);
    nextSearchParams.delete("deleted");
    setSearchParams(nextSearchParams, { replace: true });
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("deleted") !== "1") {
      deletionFlashShownRef.current = false;
    }
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 text-slate-950">
      <div className="mx-auto grid w-full max-w-4xl gap-6">
        <header className="grid gap-4 border-b border-slate-200 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase text-emerald-700">
              Allergen Finder
            </p>
            <AccountNav />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Historia sprawdzeń</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Widzisz tylko sprawdzenia zapisane na tym koncie.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex w-fit text-sm font-medium text-emerald-800 underline underline-offset-4"
          >
            Wróć do strony głównej
          </Link>
        </header>

        {flashMessage ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            {flashMessage}
          </p>
        ) : null}

        {data.records.length === 0 ? (
          <section className="rounded-md border border-dashed border-slate-300 bg-white p-8">
            <h2 className="text-xl font-semibold">Brak zapisanych sprawdzeń</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Wykonaj aktualne sprawdzenie i wybierz opcję zapisu.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block text-sm font-medium text-emerald-800 underline underline-offset-4"
            >
              Wykonaj nowe sprawdzenie
            </Link>
          </section>
        ) : (
          <div className="grid gap-4">
            {data.records.map((record) => {
              const topResult =
                reconstructSymptomCheck(record.snapshot).rankedResults[0];
              const deletePromptOpen = deletePromptRecordId === record.id;

              return (
                <article
                  key={record.id}
                  className="grid gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div>
                    <SymptomCheckSummary snapshot={record.snapshot} compact />
                    {topResult ? (
                      <p className="mt-3 text-sm text-slate-700">
                        Najwyżej w zapisanym rankingu:{" "}
                        <strong>{topResult.allergenLabel}</strong>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link
                      to={`/history/${record.id}`}
                      className="inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4"
                    >
                      Otwórz szczegóły
                    </Link>
                    <button
                      type="button"
                      onClick={() => setDeletePromptRecordId(record.id)}
                      disabled={isSubmitting}
                      className="text-sm font-semibold text-rose-800 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Usuń zapis
                    </button>
                  </div>

                  {deletePromptOpen ? (
                    <Form
                      method="post"
                      action={`/history/${record.id}`}
                      className="grid gap-3 rounded-md border border-rose-200 bg-rose-50 p-4"
                    >
                      <input type="hidden" name="intent" value="delete" />
                      <div>
                        <h2 className="text-base font-semibold text-rose-950">
                          Potwierdź usunięcie
                        </h2>
                        <p className="mt-1 text-sm leading-6 text-rose-900">
                          To usunie ten zapis na stałe. Nie będzie już widoczny
                          w historii ani dostępny w szczegółach.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => setDeletePromptRecordId(null)}
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
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
