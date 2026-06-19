import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CurrentSymptomRankedResult } from "~/domain/allergen-ranking";
import { RankingResultCard } from "./ranking-result-card";

const result: CurrentSymptomRankedResult = {
  allergenId: "grass-pollen",
  allergenLabel: "Trawy",
  likelihood: "high",
  likelihoodLabel: "Wysokie",
  pollenActivity: "unknown",
  pollenActivityLabel: "Brak danych",
  score: 9,
  matchedSymptomIds: ["sneezing"],
  matchedSymptomLabels: ["Kichanie"],
  explanation: "Test explanation.",
  matchedSymptoms: [
    {
      symptomId: "sneezing",
      label: "Kichanie",
      intensity: "high",
      intensityLabel: "Silne",
    },
  ],
};

describe("RankingResultCard", () => {
  it("renders top-result, unknown pollen, and matched symptom labels", () => {
    const html = renderToStaticMarkup(
      <RankingResultCard result={result} isTopResult />,
    );

    expect(html).toContain("Najbardziej prawdopodobne");
    expect(html).toContain("Aktywność pyłków: Brak danych");
    expect(html).toContain("Kichanie: Silne");
  });
});
