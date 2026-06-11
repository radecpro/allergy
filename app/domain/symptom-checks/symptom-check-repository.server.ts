import { createHash } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase, type Database } from "~/db/client.server";
import { symptomChecks } from "~/db/schema.server";

import { parseSymptomCheckSnapshot } from "./snapshot";
import type {
  SymptomCheckRecord,
  SymptomCheckRepository,
  SymptomCheckSnapshot,
} from "./types";

const HISTORY_LIST_LIMIT = 100;

export class SymptomCheckRequestConflictError extends Error {
  constructor() {
    super("The client request ID is already bound to another symptom check.");
  }
}

function fingerprintSnapshot(snapshot: SymptomCheckSnapshot): string {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function toRecord(
  row: typeof symptomChecks.$inferSelect,
): SymptomCheckRecord {
  const snapshot = parseSymptomCheckSnapshot({
    snapshotVersion: row.snapshotVersion,
    rankingVersion: row.rankingVersion,
    completedAt: row.completedAt.toISOString(),
    city: {
      placeId: row.cityPlaceId,
      label: row.cityLabel,
    },
    symptoms: row.symptoms,
    pollenActivity: row.pollenActivity,
  });

  if (!snapshot) {
    throw new Error(`Stored symptom check ${row.id} has an invalid snapshot.`);
  }

  return {
    id: row.id,
    snapshot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createSymptomCheckRepository(
  database: Database = getDatabase(),
): SymptomCheckRepository {
  return {
    async createForOwner(ownerId, clientRequestId, snapshot) {
      const snapshotFingerprint = fingerprintSnapshot(snapshot);
      const [created] = await database
        .insert(symptomChecks)
        .values({
          ownerId,
          clientRequestId,
          snapshotFingerprint,
          snapshotVersion: snapshot.snapshotVersion,
          rankingVersion: snapshot.rankingVersion,
          cityPlaceId: snapshot.city.placeId,
          cityLabel: snapshot.city.label,
          symptoms: snapshot.symptoms,
          pollenActivity: snapshot.pollenActivity,
          completedAt: new Date(snapshot.completedAt),
        })
        .onConflictDoNothing({
          target: [
            symptomChecks.ownerId,
            symptomChecks.clientRequestId,
          ],
        })
        .returning();

      if (created) {
        return toRecord(created);
      }

      const [existing] = await database
        .select()
        .from(symptomChecks)
        .where(
          and(
            eq(symptomChecks.ownerId, ownerId),
            eq(symptomChecks.clientRequestId, clientRequestId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new Error("Idempotent symptom-check lookup returned no record.");
      }

      if (existing.snapshotFingerprint !== snapshotFingerprint) {
        throw new SymptomCheckRequestConflictError();
      }

      return toRecord(existing);
    },

    async listForOwner(ownerId) {
      const rows = await database
        .select()
        .from(symptomChecks)
        .where(eq(symptomChecks.ownerId, ownerId))
        .orderBy(
          desc(symptomChecks.completedAt),
          desc(symptomChecks.createdAt),
        )
        .limit(HISTORY_LIST_LIMIT);

      return rows.map(toRecord);
    },

    async findForOwner(ownerId, checkId) {
      const [row] = await database
        .select()
        .from(symptomChecks)
        .where(
          and(
            eq(symptomChecks.ownerId, ownerId),
            eq(symptomChecks.id, checkId),
          ),
        )
        .limit(1);

      return row ? toRecord(row) : null;
    },
  };
}
