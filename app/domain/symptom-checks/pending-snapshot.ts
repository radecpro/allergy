import { parseSymptomCheckSnapshot } from "./snapshot";
import type { SymptomCheckSnapshot } from "./types";

export const pendingSnapshotStorageKey =
  "allergen-finder:pending-symptom-check:v1";
export const pendingSnapshotLifetimeMs = 60 * 60 * 1_000;

export type PendingSymptomCheck = {
  requestId: string;
  createdAt: string;
  expiresAt: string;
  snapshot: SymptomCheckSnapshot;
};

export type StorageLike = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export function createPendingSymptomCheck(
  requestId: string,
  snapshot: SymptomCheckSnapshot,
  now: Date = new Date(),
): PendingSymptomCheck {
  return {
    requestId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + pendingSnapshotLifetimeMs).toISOString(),
    snapshot,
  };
}

export function storePendingSymptomCheck(
  storage: StorageLike,
  pending: PendingSymptomCheck,
): boolean {
  try {
    storage.setItem(pendingSnapshotStorageKey, JSON.stringify(pending));
    return true;
  } catch {
    return false;
  }
}

export function loadPendingSymptomCheck(
  storage: StorageLike,
  now: Date = new Date(),
): PendingSymptomCheck | null {
  let raw: string | null;

  try {
    raw = storage.getItem(pendingSnapshotStorageKey);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const createdAt = new Date(String(value.createdAt));
    const expiresAt = new Date(String(value.expiresAt));
    const requestId = value.requestId;
    const snapshot = parseSymptomCheckSnapshot(value.snapshot, {
      now,
      maxAgeMs: pendingSnapshotLifetimeMs,
    });

    if (
      typeof requestId !== "string" ||
      !isUuid(requestId) ||
      Number.isNaN(createdAt.getTime()) ||
      Number.isNaN(expiresAt.getTime()) ||
      createdAt.getTime() > now.getTime() + 5 * 60 * 1_000 ||
      expiresAt.getTime() <= now.getTime() ||
      expiresAt.getTime() - createdAt.getTime() !== pendingSnapshotLifetimeMs ||
      !snapshot
    ) {
      storage.removeItem(pendingSnapshotStorageKey);
      return null;
    }

    return {
      requestId,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      snapshot,
    };
  } catch {
    try {
      storage.removeItem(pendingSnapshotStorageKey);
    } catch {
      // A storage failure already means the draft cannot be recovered.
    }
    return null;
  }
}

export function clearPendingSymptomCheck(
  storage: StorageLike,
  requestId?: string,
): boolean {
  try {
    if (requestId) {
      const pending = loadPendingSymptomCheck(storage);

      if (!pending || pending.requestId !== requestId) {
        return false;
      }
    }

    storage.removeItem(pendingSnapshotStorageKey);
    return true;
  } catch {
    return false;
  }
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
