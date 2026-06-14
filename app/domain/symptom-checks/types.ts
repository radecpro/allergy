import type {
  AllergenId,
  CurrentSymptomEntry,
  CurrentSymptomRankedResult,
  PollenActivityLevel,
  SymptomId,
  SymptomIntensity,
} from "~/domain/allergen-ranking";

export const symptomCheckSnapshotVersion = 1 as const;
export const symptomCheckRankingVersion = "current-v2" as const;

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
  symptoms: readonly CurrentSymptomEntry[];
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

export type SymptomCheckRecord = {
  id: string;
  snapshot: SymptomCheckSnapshot;
  createdAt: string;
  updatedAt: string;
};

export interface SymptomCheckRepository {
  createForOwner(
    ownerId: string,
    clientRequestId: string,
    snapshot: SymptomCheckSnapshot,
    idempotencyFingerprint?: string,
  ): Promise<SymptomCheckRecord>;
  listForOwner(ownerId: string): Promise<SymptomCheckRecord[]>;
  findForOwner(
    ownerId: string,
    checkId: string,
  ): Promise<SymptomCheckRecord | null>;
}
