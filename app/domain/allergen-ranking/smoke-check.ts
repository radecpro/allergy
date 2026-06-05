import {
  allergenCatalog,
  likelihoodLabels,
  pollenActivityLabels,
  rankCurrentSymptomAllergens,
  summarizeDestinationPollenActivity,
  symptomCatalog,
} from "./index";
import type { DestinationPollenActivitySummary } from "./index";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  assert(
    Object.is(actual, expected),
    `${message}. Expected ${String(expected)}, received ${String(actual)}.`,
  );
}

function assertIncludes(text: string, expected: string, message: string): void {
  assert(
    text.includes(expected),
    `${message}. Missing: ${expected}. Received: ${text}`,
  );
}

function collectUserFacingStrings(): string[] {
  const rankingResults = rankCurrentSymptomAllergens({
    selectedSymptomIds: ["sneezing", "runny-nose", "itchy-eyes"],
    intensity: "high",
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
    ...allergenCatalog.flatMap((allergen) => [allergen.label]),
    ...symptomCatalog.flatMap((symptom) => [symptom.label]),
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
      result.explanation,
    ]),
  ];
}

function verifyCurrentSymptomRanking(): void {
  const results = rankCurrentSymptomAllergens({
    selectedSymptomIds: ["sneezing", "runny-nose"],
    intensity: "high",
    pollenActivity: {
      "grass-pollen": "high",
      "tree-pollen": "low",
      "weed-pollen": "moderate",
      "ragweed-pollen": "unknown",
    },
  });

  assertEqual(results.length, allergenCatalog.length, "Ranking includes every MVP allergen");
  assertEqual(results[0]?.allergenId, "grass-pollen", "Grass ranks first for matching high-intensity symptoms and high pollen");
  assertEqual(results[0]?.likelihood, "high", "Top representative ranking gets high likelihood");
  assertEqual(results[0]?.likelihoodLabel, "Wysokie", "High likelihood uses Polish display label");
  assertEqual(results[0]?.pollenActivityLabel, "Wysoka", "Pollen activity uses Polish display label");

  const lowExample = rankCurrentSymptomAllergens({
    selectedSymptomIds: ["watery-eyes"],
    intensity: "low",
    pollenActivity: {
      "grass-pollen": "moderate",
      "tree-pollen": "low",
      "weed-pollen": "low",
      "ragweed-pollen": "low",
    },
  });

  assertEqual(lowExample[0]?.allergenId, "grass-pollen", "One low-intensity match with moderate pollen keeps stable ranking");
  assertEqual(lowExample[0]?.likelihood, "low", "One low-intensity match with moderate pollen remains low likelihood");
  assertEqual(lowExample[0]?.likelihoodLabel, "Niskie", "Low likelihood uses Polish display label");
}

function verifyUnknownPollenFallback(): void {
  const results = rankCurrentSymptomAllergens({
    selectedSymptomIds: ["blocked-nose", "scratchy-throat"],
    intensity: "high",
    pollenActivity: {
      "weed-pollen": "unknown",
      "ragweed-pollen": "unknown",
    },
  });
  const weedResult = results.find((result) => result.allergenId === "weed-pollen");

  assert(weedResult !== undefined, "Unknown pollen activity does not remove matching allergens");
  assertEqual(weedResult.pollenActivity, "unknown", "Unknown pollen activity is preserved in output");
  assertEqual(weedResult.pollenActivityLabel, "Brak danych", "Unknown pollen activity uses Polish fallback label");
  assertIncludes(
    weedResult.explanation,
    "Brak danych o aktualnej aktywności pyłków obniża pewność oceny.",
    "Unknown pollen fallback explains lower confidence",
  );
}

function verifyDestinationActivityOnly(): void {
  const results: DestinationPollenActivitySummary[] = summarizeDestinationPollenActivity({
    pollenActivity: {
      "grass-pollen": "very-high",
      "tree-pollen": "moderate",
      "weed-pollen": "unknown",
      "ragweed-pollen": "low",
    },
  });

  assertEqual(results.length, allergenCatalog.length, "Destination output includes every MVP allergen");
  assertEqual(results[0]?.allergenId, allergenCatalog[0]?.id, "Destination output keeps catalog order");
  assertEqual(results[0]?.pollenActivityLabel, "Bardzo wysoka", "Destination activity uses Polish display label");
  assert(
    results.every((result) => !("likelihood" in result) && !("likelihoodLabel" in result)),
    "Destination output does not include personal likelihood fields",
  );
  assert(
    results.every((result) =>
      result.explanation.includes("nie określa osobistego prawdopodobieństwa objawów") ||
      result.explanation.includes("tylko kontekst środowiskowy"),
    ),
    "Destination explanations stay framed as environmental activity",
  );
}

function verifyPolishDisplayStrings(): void {
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
  const userFacingStrings = collectUserFacingStrings();

  for (const text of userFacingStrings) {
    for (const token of internalEnglishTokens) {
      assert(
        !text.includes(token),
        `User-facing string leaked internal English token "${token}": ${text}`,
      );
    }
  }
}

function verifyMedicalGuardrails(): void {
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
  const userFacingStrings = collectUserFacingStrings();

  for (const text of userFacingStrings) {
    for (const pattern of bannedAdvicePatterns) {
      assert(
        !pattern.test(text),
        `User-facing string contains treatment or medication advice wording (${pattern}): ${text}`,
      );
    }
  }
}

verifyCurrentSymptomRanking();
verifyUnknownPollenFallback();
verifyDestinationActivityOnly();
verifyPolishDisplayStrings();
verifyMedicalGuardrails();

console.log("Allergen ranking smoke checks passed.");
