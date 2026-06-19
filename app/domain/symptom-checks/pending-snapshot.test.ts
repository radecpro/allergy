import { describe, expect, it } from "vitest";

import { buildCurrentSymptomSnapshot } from "./snapshot";
import {
  clearPendingSymptomCheck,
  createPendingSymptomCheck,
  loadPendingSymptomCheck,
  pendingSnapshotLifetimeMs,
  pendingSnapshotStorageKey,
  storePendingSymptomCheck,
} from "./pending-snapshot";

class MemoryStorage {
  values = new Map<string, string>();
  failWrites = false;

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    if (this.failWrites) {
      throw new Error("storage unavailable");
    }
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

const now = new Date("2026-06-11T12:00:00.000Z");
const requestId = "123e4567-e89b-42d3-a456-426614174000";
const snapshot = buildCurrentSymptomSnapshot({
  city: { placeId: "warsaw", label: "Warszawa, Polska" },
  symptoms: [
    { symptomId: "blocked-nose", intensity: "high" },
    { symptomId: "watery-eyes", intensity: "low" },
  ],
  pollenActivity: { "grass-pollen": "high" },
  completedAt: now,
});

describe("pending symptom-check storage", () => {
  it("stores and restores a supported unexpired draft", () => {
    const storage = new MemoryStorage();
    const pending = createPendingSymptomCheck(requestId, snapshot, now);

    expect(storePendingSymptomCheck(storage, pending)).toBe(true);
    expect(
      loadPendingSymptomCheck(
        storage,
        new Date(now.getTime() + pendingSnapshotLifetimeMs - 1),
      ),
    ).toEqual(pending);
  });

  it("does not read or migrate a legacy storage key", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "allergen-finder:pending-symptom-check:v1",
      JSON.stringify(createPendingSymptomCheck(requestId, snapshot, now)),
    );

    expect(loadPendingSymptomCheck(storage, now)).toBeNull();
    expect(
      storage.getItem("allergen-finder:pending-symptom-check:v1"),
    ).not.toBeNull();
    expect(storage.getItem(pendingSnapshotStorageKey)).toBeNull();
  });

  it("removes expired and malformed drafts", () => {
    const storage = new MemoryStorage();
    storePendingSymptomCheck(
      storage,
      createPendingSymptomCheck(requestId, snapshot, now),
    );

    expect(
      loadPendingSymptomCheck(
        storage,
        new Date(now.getTime() + pendingSnapshotLifetimeMs),
      ),
    ).toBeNull();
    expect(storage.getItem(pendingSnapshotStorageKey)).toBeNull();

    storage.setItem(pendingSnapshotStorageKey, "{bad-json");
    expect(loadPendingSymptomCheck(storage, now)).toBeNull();
  });

  it("reports storage write failure without throwing", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;

    expect(
      storePendingSymptomCheck(
        storage,
        createPendingSymptomCheck(requestId, snapshot, now),
      ),
    ).toBe(false);
  });

  it("clears only the matching successful request", () => {
    const storage = new MemoryStorage();
    storePendingSymptomCheck(
      storage,
      createPendingSymptomCheck(requestId, snapshot, now),
    );

    expect(
      clearPendingSymptomCheck(
        storage,
        "223e4567-e89b-42d3-a456-426614174000",
      ),
    ).toBe(false);
    expect(storage.getItem(pendingSnapshotStorageKey)).not.toBeNull();
    expect(clearPendingSymptomCheck(storage, requestId)).toBe(true);
    expect(storage.getItem(pendingSnapshotStorageKey)).toBeNull();
  });
});
