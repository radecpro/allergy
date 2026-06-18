import { useEffect, useRef, useState } from "react";
import { Link, useLoaderData, useSearchParams } from "react-router";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const deletionFlashShownRef = useRef(false);

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

              return (
                <article
                  key={record.id}
                  className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <SymptomCheckSummary snapshot={record.snapshot} compact />
                  {topResult ? (
                    <p className="mt-3 text-sm text-slate-700">
                      Najwyżej w zapisanym rankingu:{" "}
                      <strong>{topResult.allergenLabel}</strong>
                    </p>
                  ) : null}
                  <Link
                    to={`/history/${record.id}`}
                    className="mt-4 inline-block text-sm font-semibold text-emerald-800 underline underline-offset-4"
                  >
                    Otwórz szczegóły
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
