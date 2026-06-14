export const symptomIntensityIds = ["low", "high"] as const;

export type SymptomIntensity = (typeof symptomIntensityIds)[number];

export const pollenActivityLevelIds = [
  "unknown",
  "low",
  "moderate",
  "high",
  "very-high",
] as const;

export type PollenActivityLevel = (typeof pollenActivityLevelIds)[number];

export const likelihoodLevelIds = ["high", "medium", "low"] as const;

export type LikelihoodLevel = (typeof likelihoodLevelIds)[number];

export const allergenIds = [
  "grass-pollen",
  "tree-pollen",
  "weed-pollen",
  "ragweed-pollen",
] as const;

export type AllergenId = (typeof allergenIds)[number];

export const symptomIds = [
  "sneezing",
  "runny-nose",
  "blocked-nose",
  "itchy-eyes",
  "watery-eyes",
  "scratchy-throat",
] as const;

export type SymptomId = (typeof symptomIds)[number];

export type DisplayLabel<TId extends string> = {
  id: TId;
  label: string;
};

export type AllergenCatalogItem = DisplayLabel<AllergenId> & {
  symptomIds: readonly SymptomId[];
};

export type SymptomCatalogItem = DisplayLabel<SymptomId>;

export type PollenActivityByAllergen = Partial<
  Record<AllergenId, PollenActivityLevel>
>;

export type CurrentSymptomEntry = {
  symptomId: SymptomId;
  intensity: SymptomIntensity;
};

export type MatchedSymptomEntry = CurrentSymptomEntry & {
  label: string;
  intensityLabel: string;
};

export type CurrentSymptomRankingInput = {
  symptoms: readonly CurrentSymptomEntry[];
  pollenActivity: PollenActivityByAllergen;
};

export type CurrentSymptomRankedResult = {
  allergenId: AllergenId;
  allergenLabel: string;
  matchedSymptoms: readonly MatchedSymptomEntry[];
  matchedSymptomIds: readonly SymptomId[];
  matchedSymptomLabels: readonly string[];
  likelihood: LikelihoodLevel;
  likelihoodLabel: string;
  pollenActivity: PollenActivityLevel;
  pollenActivityLabel: string;
  score: number;
  explanation: string;
};

export type DestinationPollenActivityInput = {
  pollenActivity: PollenActivityByAllergen;
};

export type DestinationPollenActivitySummary = {
  allergenId: AllergenId;
  allergenLabel: string;
  pollenActivity: PollenActivityLevel;
  pollenActivityLabel: string;
  possibleSymptomLabels: readonly string[];
  explanation: string;
};
