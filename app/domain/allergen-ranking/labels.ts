import type {
  LikelihoodLevel,
  PollenActivityLevel,
  SymptomId,
  SymptomIntensity,
} from "./types";

export const symptomIntensityLabels = {
  low: "Niska",
  high: "Wysoka",
} as const satisfies Record<SymptomIntensity, string>;

export const likelihoodLabels = {
  high: "Wysokie",
  medium: "Średnie",
  low: "Niskie",
} as const satisfies Record<LikelihoodLevel, string>;

export const pollenActivityLabels = {
  unknown: "Brak danych",
  low: "Niska",
  moderate: "Umiarkowana",
  high: "Wysoka",
  "very-high": "Bardzo wysoka",
} as const satisfies Record<PollenActivityLevel, string>;

export const symptomLabels = {
  sneezing: "Kichanie",
  "runny-nose": "Katar",
  "blocked-nose": "Zatkany nos",
  "itchy-eyes": "Swędzenie oczu",
  "watery-eyes": "Łzawienie oczu",
  "scratchy-throat": "Drapanie w gardle",
} as const satisfies Record<SymptomId, string>;

export const resultGuardrailText =
  "To informacja orientacyjna, a nie diagnoza medyczna.";
