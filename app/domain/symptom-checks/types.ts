import type {
  AllergenId,
  CurrentSymptomRankedResult,
  PollenActivityLevel,
  SymptomId,
  SymptomIntensity,
} from "~/domain/allergen-ranking";

export const symptomCheckSnapshotVersion = 1 as const;
export const symptomCheckRankingVersion = "current-v1" as const;

export type SavedSymptomEntry = {
  symptomId: SymptomId;
  intensity: SymptomIntensity;
};

export type SavedPollenActivity = Record<AllergenId, PollenActivityLevel>;

export type SymptomCheckSnapshot = {
  snapshotVersion: typeof symptomCheckSnapshotVersion;
  rankingVersion: typeof symptomCheckRankingVersion;
  completedAt: string;
  city: {
    placeId: string;
    label: string;
  };
  symptoms: SavedSymptomEntry[];
  pollenActivity: SavedPollenActivity;
};

export type BuildCurrentSymptomSnapshotInput = {
  city: {
    placeId: string;
    label: string;
  };
  selectedSymptomIds: readonly SymptomId[];
  intensity: SymptomIntensity;
  pollenActivity: Partial<SavedPollenActivity>;
  completedAt?: Date;
};

export type ParseSnapshotOptions = {
  now?: Date;
  maxAgeMs?: number;
  futureSkewMs?: number;
};

export type ReconstructedSymptomCheck = {
  snapshot: SymptomCheckSnapshot;
  rankedResults: CurrentSymptomRankedResult[];
};
