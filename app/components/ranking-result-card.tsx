import type { CurrentSymptomRankedResult } from "~/domain/allergen-ranking";

import { Panel } from "./panel";
import { Pill } from "./pill";

type RankingResultCardProps = {
  result: CurrentSymptomRankedResult;
  isTopResult?: boolean;
  topLabel?: string;
  headingLevel?: "h3" | "h4";
};

export function RankingResultCard({
  result,
  isTopResult = false,
  topLabel = "Najbardziej prawdopodobne",
  headingLevel = "h3",
}: RankingResultCardProps) {
  const Heading = headingLevel;

  return (
    <Panel
      as="article"
      className={`p-4 ${
        isTopResult
          ? "border-emerald-500 bg-emerald-50 shadow-emerald-100"
          : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {isTopResult ? (
            <p className="text-sm font-semibold uppercase tracking-normal text-emerald-800">
              {topLabel}
            </p>
          ) : null}
          <Heading className="mt-1 text-lg font-semibold text-slate-950">
            {result.allergenLabel}
          </Heading>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill tone="success">Prawdopodobieństwo: {result.likelihoodLabel}</Pill>
          <Pill tone={result.pollenActivity === "unknown" ? "warning" : "neutral"}>
            Aktywność pyłków: {result.pollenActivityLabel}
          </Pill>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        <p className="text-sm font-medium text-slate-700">Pasujące objawy</p>
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
    </Panel>
  );
}
