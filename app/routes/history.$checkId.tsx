import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
} from "react-router";

import { AccountNav } from "~/components/account-nav";
import { SymptomCheckSummary } from "~/components/symptom-check-summary";
import { clearPendingSymptomCheck } from "~/domain/symptom-checks/pending-snapshot";
import { reconstructSymptomCheck } from "~/domain/symptom-checks/snapshot";
import { createProductionSymptomCheckDependencies } from "~/domain/symptom-checks/dependencies.server";
import {
  createSymptomCheckDetailLoader,
} from "~/domain/symptom-checks/symptom-check-route-handlers.server";
import type { SymptomCheckDetailLoaderData } from "~/domain/symptom-checks/symptom-check-route-handlers.server";

import type { Route } from "./+types/history.$checkId";

export function meta() {
  return [{ title: "Allergen Finder | Zapisane sprawdzenie" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  return createSymptomCheckDetailLoader(
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
  const rankedResults = reconstructSymptomCheck(
    data.record.snapshot,
  ).rankedResults;

  useEffect(() => {
    if (!data.saved) {
      return;
    }

    if (data.requestId) {
      clearPendingSymptomCheck(window.sessionStorage, data.requestId);
    }

    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname,
    );
  }, [data.requestId, data.saved]);

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-6 text-slate-950">
      <div className="mx-auto grid w-full max-w-3xl gap-6">
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

        {data.saved ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
            Sprawdzenie zostało zapisane.
          </p>
        ) : null}

        <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
          <SymptomCheckSummary snapshot={data.record.snapshot} />
        </section>

        <section className="grid gap-3" aria-labelledby="saved-results-heading">
          <div>
            <h2 id="saved-results-heading" className="text-xl font-semibold">
              Zapisany ranking
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Wynik jest orientacyjny i nie stanowi diagnozy medycznej.
            </p>
          </div>
          {rankedResults.map((result, index) => (
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
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-800">
                    Pyłki: {result.pollenActivityLabel}
                  </span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                {result.explanation}
              </p>
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
          ))}
        </section>

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
