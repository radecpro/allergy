import {
  allergenIds,
  pollenActivityLevelIds,
  rankCurrentSymptomAllergens,
  symptomIds,
  symptomIntensityIds,
} from "~/domain/allergen-ranking";
import type {
  PollenActivityLevel,
  SymptomId,
  SymptomIntensity,
} from "~/domain/allergen-ranking";

import {
  symptomCheckRankingVersion,
  symptomCheckSnapshotVersion,
} from "./types";
import type {
  BuildCurrentSymptomSnapshotInput,
  ParseSnapshotOptions,
  ReconstructedSymptomCheck,
  SavedPollenActivity,
  SavedSymptomEntry,
  SymptomCheckSnapshot,
} from "./types";

const MAX_CITY_PLACE_ID_LENGTH = 256;
const MAX_CITY_LABEL_LENGTH = 160;
const DEFAULT_FUTURE_SKEW_MS = 5 * 60 * 1_000;

const snapshotKeys = new Set([
  "snapshotVersion",
  "rankingVersion",
  "completedAt",
  "city",
  "symptoms",
  "pollenActivity",
]);
const cityKeys = new Set(["placeId", "label"]);
const symptomKeys = new Set(["symptomId", "intensity"]);
const symptomIdSet = new Set<string>(symptomIds);
const intensitySet = new Set<string>(symptomIntensityIds);
const pollenLevelSet = new Set<string>(pollenActivityLevelIds);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: Set<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isBoundedString(
  value: unknown,
  maximumLength: number,
): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximumLength
  );
}

function isSymptomId(value: unknown): value is SymptomId {
  return typeof value === "string" && symptomIdSet.has(value);
}

function isSymptomIntensity(value: unknown): value is SymptomIntensity {
  return typeof value === "string" && intensitySet.has(value);
}

function isPollenActivityLevel(
  value: unknown,
): value is PollenActivityLevel {
  return typeof value === "string" && pollenLevelSet.has(value);
}

function canonicalizePollenActivity(
  value: Partial<SavedPollenActivity>,
): SavedPollenActivity {
  return Object.fromEntries(
    allergenIds.map((allergenId) => [
      allergenId,
      value[allergenId] ?? "unknown",
    ]),
  ) as SavedPollenActivity;
}

function parseCompletedAt(
  value: unknown,
  options: ParseSnapshotOptions,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const completedAt = new Date(value);

  if (Number.isNaN(completedAt.getTime())) {
    return null;
  }

  const now = options.now ?? new Date();
  const futureSkewMs = options.futureSkewMs ?? DEFAULT_FUTURE_SKEW_MS;

  if (completedAt.getTime() > now.getTime() + futureSkewMs) {
    return null;
  }

  if (
    options.maxAgeMs !== undefined &&
    now.getTime() - completedAt.getTime() > options.maxAgeMs
  ) {
    return null;
  }

  return completedAt.toISOString();
}

export function parseSavedSymptomEntries(
  value: unknown,
): SavedSymptomEntry[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > symptomIds.length) {
    return null;
  }

  const parsed: SavedSymptomEntry[] = [];
  const seen = new Set<SymptomId>();

  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !hasOnlyKeys(entry, symptomKeys) ||
      !isSymptomId(entry.symptomId) ||
      !isSymptomIntensity(entry.intensity) ||
      seen.has(entry.symptomId)
    ) {
      return null;
    }

    seen.add(entry.symptomId);
    parsed.push({
      symptomId: entry.symptomId,
      intensity: entry.intensity,
    });
  }

  return parsed;
}

function parsePollenActivity(value: unknown): SavedPollenActivity | null {
  if (!isRecord(value) || !hasOnlyKeys(value, new Set(allergenIds))) {
    return null;
  }

  const entries = allergenIds.map((allergenId) => {
    const level = value[allergenId] ?? "unknown";
    return isPollenActivityLevel(level) ? [allergenId, level] : null;
  });

  if (entries.some((entry) => entry === null)) {
    return null;
  }

  return Object.fromEntries(entries as [string, PollenActivityLevel][]) as SavedPollenActivity;
}

export function buildCurrentSymptomSnapshot(
  input: BuildCurrentSymptomSnapshotInput,
): SymptomCheckSnapshot {
  const completedAt = input.completedAt ?? new Date();

  return {
    snapshotVersion: symptomCheckSnapshotVersion,
    rankingVersion: symptomCheckRankingVersion,
    completedAt: completedAt.toISOString(),
    city: {
      placeId: input.city.placeId,
      label: input.city.label,
    },
    symptoms: input.symptoms.map((symptom) => ({ ...symptom })),
    pollenActivity: canonicalizePollenActivity(input.pollenActivity),
  };
}

export function parseSymptomCheckSnapshot(
  value: unknown,
  options: ParseSnapshotOptions = {},
): SymptomCheckSnapshot | null {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, snapshotKeys) ||
    value.snapshotVersion !== symptomCheckSnapshotVersion ||
    value.rankingVersion !== symptomCheckRankingVersion ||
    !isRecord(value.city) ||
    !hasOnlyKeys(value.city, cityKeys) ||
    !isBoundedString(value.city.placeId, MAX_CITY_PLACE_ID_LENGTH) ||
    !isBoundedString(value.city.label, MAX_CITY_LABEL_LENGTH)
  ) {
    return null;
  }

  const completedAt = parseCompletedAt(value.completedAt, options);
  const symptoms = parseSavedSymptomEntries(value.symptoms);
  const pollenActivity = parsePollenActivity(value.pollenActivity);

  if (!completedAt || !symptoms || !pollenActivity) {
    return null;
  }

  return {
    snapshotVersion: symptomCheckSnapshotVersion,
    rankingVersion: symptomCheckRankingVersion,
    completedAt,
    city: {
      placeId: value.city.placeId,
      label: value.city.label,
    },
    symptoms,
    pollenActivity,
  };
}

export function reconstructSymptomCheck(
  snapshot: SymptomCheckSnapshot,
): ReconstructedSymptomCheck {
  return {
    snapshot,
    rankedResults: rankCurrentSymptomAllergens({
      symptoms: snapshot.symptoms,
      pollenActivity: snapshot.pollenActivity,
    }),
  };
}
