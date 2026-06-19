import { useEffect, useRef, useState } from "react";
import {
  Form,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";

import { AppShell } from "~/components/app-shell";
import { Button } from "~/components/button";
import { EmptyState } from "~/components/empty-state";
import { Notice } from "~/components/notice";
import { Panel } from "~/components/panel";
import { SymptomCheckSummary } from "~/components/symptom-check-summary";
import { TextLink } from "~/components/text-link";
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
    <AppShell
      title="Historia sprawdzeń"
      description="Widzisz tylko sprawdzenia zapisane na tym koncie."
      maxWidth="4xl"
      headerAction={
        <TextLink to="/" className="w-fit">
            Wróć do strony głównej
        </TextLink>
      }
    >

        {flashMessage ? (
          <Notice tone="success" role="status">{flashMessage}</Notice>
        ) : null}

        {data.records.length === 0 ? (
          <EmptyState
            title="Brak zapisanych sprawdzeń"
            action={<TextLink to="/">Wykonaj nowe sprawdzenie</TextLink>}
          >
              Wykonaj aktualne sprawdzenie i wybierz opcję zapisu.
          </EmptyState>
        ) : (
          <div className="grid gap-4">
            {data.records.map((record) => {
              const topResult =
                reconstructSymptomCheck(record.snapshot).rankedResults[0];
              const deletePromptOpen = deletePromptRecordId === record.id;

              return (
                <Panel
                  as="article"
                  key={record.id}
                  className="grid gap-4"
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
                    <TextLink to={`/history/${record.id}`} className="font-semibold">
                      Otwórz szczegóły
                    </TextLink>
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
                        <Button
                          type="button"
                          onClick={() => setDeletePromptRecordId(null)}
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
                  ) : null}
                </Panel>
              );
            })}
          </div>
        )}
    </AppShell>
  );
}
