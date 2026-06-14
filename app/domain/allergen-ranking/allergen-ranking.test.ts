import { describe, expect, test } from "vitest";
import {
  allergenCatalog,
  likelihoodLabels,
  pollenActivityLabels,
  rankCurrentSymptomAllergens,
  summarizeDestinationPollenActivity,
  symptomCatalog,
} from "./index";

function collectUserFacingStrings(): string[] {
  const rankingResults = rankCurrentSymptomAllergens({
    symptoms: [
      { symptomId: "sneezing", intensity: "high" },
      { symptomId: "runny-nose", intensity: "high" },
      { symptomId: "itchy-eyes", intensity: "high" },
    ],
    pollenActivity: {
      "grass-pollen": "high",
      "tree-pollen": "moderate",
      "weed-pollen": "unknown",
      "ragweed-pollen": "low",
    },
  });
  const destinationResults = summarizeDestinationPollenActivity({
    pollenActivity: {
      "grass-pollen": "very-high",
      "tree-pollen": "low",
    },
  });

  return [
    ...allergenCatalog.map((allergen) => allergen.label),
    ...symptomCatalog.map((symptom) => symptom.label),
    ...Object.values(likelihoodLabels),
    ...Object.values(pollenActivityLabels),
    ...rankingResults.flatMap((result) => [
      result.allergenLabel,
      result.likelihoodLabel,
      result.pollenActivityLabel,
      result.explanation,
      ...result.matchedSymptomLabels,
    ]),
    ...destinationResults.flatMap((result) => [
      result.allergenLabel,
      result.pollenActivityLabel,
      ...result.possibleSymptomLabels,
      result.explanation,
    ]),
  ];
}

describe("current symptom allergen ranking", () => {
  test("ranks a strong grass-pollen match first with high likelihood", () => {
    const results = rankCurrentSymptomAllergens({
      symptoms: [
        { symptomId: "sneezing", intensity: "high" },
        { symptomId: "runny-nose", intensity: "high" },
      ],
      pollenActivity: {
        "grass-pollen": "high",
        "tree-pollen": "low",
        "weed-pollen": "moderate",
        "ragweed-pollen": "unknown",
      },
    });

    expect(results).toHaveLength(allergenCatalog.length);
    expect(results[0]).toMatchObject({
      allergenId: "grass-pollen",
      likelihood: "high",
      likelihoodLabel: "Wysokie",
      pollenActivityLabel: "Wysoka",
    });
  });

  test("keeps a low-intensity single match at low likelihood", () => {
    const results = rankCurrentSymptomAllergens({
      symptoms: [{ symptomId: "watery-eyes", intensity: "low" }],
      pollenActivity: {
        "grass-pollen": "moderate",
        "tree-pollen": "low",
        "weed-pollen": "low",
        "ragweed-pollen": "low",
      },
    });

    expect(results[0]).toMatchObject({
      allergenId: "grass-pollen",
      likelihood: "low",
      likelihoodLabel: "Niskie",
    });
  });

  test("preserves unknown pollen activity and explains reduced confidence", () => {
    const results = rankCurrentSymptomAllergens({
      symptoms: [
        { symptomId: "blocked-nose", intensity: "high" },
        { symptomId: "scratchy-throat", intensity: "high" },
      ],
      pollenActivity: {
        "weed-pollen": "unknown",
        "ragweed-pollen": "unknown",
      },
    });
    const weedResult = results.find((result) => result.allergenId === "weed-pollen");

    expect(weedResult).toMatchObject({
      pollenActivity: "unknown",
      pollenActivityLabel: "Brak danych",
    });
    expect(weedResult?.explanation).toContain(
      "Brak danych o aktualnej aktywności pyłków obniża pewność oceny.",
    );
  });

  test("scores mixed symptom intensities independently", () => {
    const results = rankCurrentSymptomAllergens({
      symptoms: [
        { symptomId: "blocked-nose", intensity: "high" },
        { symptomId: "watery-eyes", intensity: "low" },
      ],
      pollenActivity: {
        "grass-pollen": "low",
        "tree-pollen": "low",
        "weed-pollen": "low",
        "ragweed-pollen": "low",
      },
    });

    expect(results.map(({ allergenId, score }) => ({ allergenId, score }))).toEqual([
      { allergenId: "weed-pollen", score: 2 },
      { allergenId: "ragweed-pollen", score: 2 },
      { allergenId: "grass-pollen", score: 1 },
      { allergenId: "tree-pollen", score: 1 },
    ]);
    expect(results[0]?.matchedSymptoms).toEqual([
      {
        symptomId: "blocked-nose",
        label: "Zatkany nos",
        intensity: "high",
        intensityLabel: "Wysoka",
      },
    ]);
    expect(results[2]?.matchedSymptoms).toEqual([
      {
        symptomId: "watery-eyes",
        label: "Łzawienie oczu",
        intensity: "low",
        intensityLabel: "Niska",
      },
    ]);
  });

  test.each([
    {
      intensity: "low" as const,
      expectedScores: [2, 2, 2, 2],
    },
    {
      intensity: "high" as const,
      expectedScores: [4, 4, 4, 4],
    },
  ])("retains uniform $intensity scoring outcomes", ({ intensity, expectedScores }) => {
    const results = rankCurrentSymptomAllergens({
      symptoms: [
        { symptomId: "sneezing", intensity },
        { symptomId: "runny-nose", intensity },
      ],
      pollenActivity: {},
    });

    expect(results.map((result) => result.score)).toEqual(expectedScores);
  });
});

describe("destination pollen activity", () => {
  test("returns every allergen in stable catalog order with Polish labels", () => {
    const results = summarizeDestinationPollenActivity({
      pollenActivity: {
        "grass-pollen": "very-high",
        "tree-pollen": "moderate",
        "weed-pollen": "unknown",
        "ragweed-pollen": "low",
      },
    });

    expect(results).toHaveLength(allergenCatalog.length);
    expect(results.map((result) => result.allergenId)).toEqual(
      allergenCatalog.map((allergen) => allergen.id),
    );
    expect(results[0]?.pollenActivityLabel).toBe("Bardzo wysoka");
    expect(results.every((result) => result.possibleSymptomLabels.length > 0)).toBe(true);
  });

  test("describes environmental activity without personal likelihood fields", () => {
    const results = summarizeDestinationPollenActivity({
      pollenActivity: {
        "grass-pollen": "very-high",
        "tree-pollen": "moderate",
        "weed-pollen": "unknown",
        "ragweed-pollen": "low",
      },
    });

    expect(
      results.every(
        (result) => !("likelihood" in result) && !("likelihoodLabel" in result),
      ),
    ).toBe(true);
    expect(
      results.every(
        (result) =>
          result.explanation.includes(
            "nie określa osobistego prawdopodobieństwa objawów",
          ) || result.explanation.includes("tylko kontekst środowiskowy"),
      ),
    ).toBe(true);
  });
});

describe("user-facing safety contracts", () => {
  test("does not leak internal English identifiers into Polish display strings", () => {
    const internalEnglishTokens = [
      "grass-pollen",
      "tree-pollen",
      "weed-pollen",
      "ragweed-pollen",
      "sneezing",
      "runny-nose",
      "blocked-nose",
      "itchy-eyes",
      "watery-eyes",
      "scratchy-throat",
      "unknown",
      "moderate",
      "very-high",
    ];

    for (const text of collectUserFacingStrings()) {
      for (const token of internalEnglishTokens) {
        expect(text, `Internal token "${token}" leaked in: ${text}`).not.toContain(token);
      }
    }
  });

  test("does not include treatment or medication advice wording", () => {
    const bannedAdvicePatterns = [
      /\bleczenie\b/i,
      /\bleczyć\b/i,
      /\blek\b/i,
      /\bleki\b/i,
      /\btablet/i,
      /\bantyhistamin/i,
      /\bstosuj\b/i,
      /\bweź\b/i,
      /\bzażyj\b/i,
      /\bdawka\b/i,
    ];

    for (const text of collectUserFacingStrings()) {
      for (const pattern of bannedAdvicePatterns) {
        expect(text, `Prohibited wording ${pattern} found in: ${text}`).not.toMatch(pattern);
      }
    }
  });
});
