import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { count, eq, inArray } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "~/db/schema.server";
import { createCurrentPollenAction } from "~/routes/api.current-pollen";

import { buildCurrentSymptomSnapshot } from "./snapshot";
import {
  createSymptomCheckRepository,
  fingerprintSymptomCheckSnapshot,
  SymptomCheckRequestConflictError,
} from "./symptom-check-repository.server";
import { createSaveSymptomCheckAction } from "./symptom-check-route-handlers.server";

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "TEST_DATABASE_URL is required and must reference a disposable PostgreSQL database.",
  );
}

const pool = new Pool({
  connectionString,
  max: 3,
  connectionTimeoutMillis: 5_000,
});
const database = drizzle(pool, { schema });
const repository = createSymptomCheckRepository(database);
const ownerIds: string[] = [];

function snapshot(
  cityLabel: string,
  completedAt: string,
  intensity: "low" | "high" = "high",
) {
  return buildCurrentSymptomSnapshot({
    city: {
      placeId: `place-${cityLabel.toLowerCase()}`,
      label: cityLabel,
    },
    symptoms: [
      { symptomId: "sneezing", intensity },
      { symptomId: "itchy-eyes", intensity },
    ],
    pollenActivity: {
      "grass-pollen": "high",
      "tree-pollen": "moderate",
    },
    completedAt: new Date(completedAt),
  });
}

function mixedSnapshot(cityLabel: string, completedAt: string) {
  return buildCurrentSymptomSnapshot({
    city: {
      placeId: `place-${cityLabel.toLowerCase()}`,
      label: cityLabel,
    },
    symptoms: [
      { symptomId: "blocked-nose", intensity: "high" },
      { symptomId: "watery-eyes", intensity: "low" },
    ],
    pollenActivity: {
      "grass-pollen": "low",
      "tree-pollen": "moderate",
      "weed-pollen": "high",
      "ragweed-pollen": "unknown",
    },
    completedAt: new Date(completedAt),
  });
}

beforeAll(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });

  const inserted = await database
    .insert(schema.users)
    .values([
      {
        identityPlatformUid: `symptom-check-a-${randomUUID()}`,
        email: `symptom-a-${randomUUID()}@example.test`,
        normalizedEmail: `symptom-a-${randomUUID()}@example.test`,
      },
      {
        identityPlatformUid: `symptom-check-b-${randomUUID()}`,
        email: `symptom-b-${randomUUID()}@example.test`,
        normalizedEmail: `symptom-b-${randomUUID()}@example.test`,
      },
    ])
    .returning({ id: schema.users.id });

  ownerIds.push(...inserted.map((row) => row.id));
});

afterAll(async () => {
  if (ownerIds.length > 0) {
    await database
      .delete(schema.symptomChecks)
      .where(inArray(schema.symptomChecks.ownerId, ownerIds));
    await database.delete(schema.users).where(inArray(schema.users.id, ownerIds));
  }

  await pool.end();
});

describe("PostgreSQL symptom-check repository", () => {
  it("scopes create, list, and detail reads to the authenticated owner", async () => {
    const [ownerA, ownerB] = ownerIds;
    const olderA = await repository.createForOwner(
      ownerA,
      randomUUID(),
      snapshot("Warszawa", "2026-06-10T10:00:00.000Z"),
    );
    const newerA = await repository.createForOwner(
      ownerA,
      randomUUID(),
      snapshot("Kraków", "2026-06-11T10:00:00.000Z"),
    );
    const recordB = await repository.createForOwner(
      ownerB,
      randomUUID(),
      snapshot("Gdańsk", "2026-06-11T11:00:00.000Z"),
    );

    await expect(repository.listForOwner(ownerA)).resolves.toEqual([
      newerA,
      olderA,
    ]);
    await expect(repository.listForOwner(ownerB)).resolves.toEqual([recordB]);
    await expect(repository.findForOwner(ownerA, newerA.id)).resolves.toEqual(
      newerA,
    );
    await expect(repository.findForOwner(ownerB, newerA.id)).resolves.toBeNull();
    await expect(
      repository.findForOwner(ownerA, randomUUID()),
    ).resolves.toBeNull();
  });

  it("round-trips exact mixed entries and current-v2 through list and detail", async () => {
    const [ownerA, ownerB] = ownerIds;
    const input = mixedSnapshot("Lublin", "2026-06-11T11:30:00.000Z");
    const created = await repository.createForOwner(
      ownerA,
      randomUUID(),
      input,
    );
    const listed = await repository.listForOwner(ownerA);

    expect(created.snapshot).toEqual(input);
    expect(created.snapshot).toMatchObject({
      rankingVersion: "current-v2",
      symptoms: [
        { symptomId: "blocked-nose", intensity: "high" },
        { symptomId: "watery-eyes", intensity: "low" },
      ],
    });
    expect(listed).toContainEqual(created);
    await expect(repository.findForOwner(ownerA, created.id)).resolves.toEqual(
      created,
    );
    await expect(repository.findForOwner(ownerB, created.id)).resolves.toBeNull();
  });

  it("returns one stable record for concurrent same-content retries", async () => {
    const requestId = randomUUID();
    const input = snapshot("Poznań", "2026-06-11T12:00:00.000Z");
    const records = await Promise.all([
      repository.createForOwner(ownerIds[0], requestId, input),
      repository.createForOwner(ownerIds[0], requestId, input),
    ]);

    expect(records[0].id).toBe(records[1].id);

    const [rowCount] = await database
      .select({ value: count() })
      .from(schema.symptomChecks)
      .where(eq(schema.symptomChecks.clientRequestId, requestId));

    expect(rowCount?.value).toBe(1);
  });

  it("ignores regenerated completion time for an idempotent direct retry", async () => {
    const requestId = randomUUID();
    const submitted = snapshot(
      "Szczecin",
      "2026-06-10T11:59:00.000Z",
    );
    const fingerprint = fingerprintSymptomCheckSnapshot(submitted);
    const first = await repository.createForOwner(
      ownerIds[0],
      requestId,
      snapshot("Szczecin", "2026-06-10T12:00:00.000Z"),
      fingerprint,
    );
    const retried = await repository.createForOwner(
      ownerIds[0],
      requestId,
      snapshot("Szczecin", "2026-06-10T12:01:00.000Z"),
      fingerprint,
    );

    expect(retried).toEqual(first);
  });

  it("rejects request-ID reuse with different canonical content", async () => {
    const requestId = randomUUID();
    await repository.createForOwner(
      ownerIds[0],
      requestId,
      snapshot("Łódź", "2026-06-10T13:00:00.000Z"),
    );

    await expect(
      repository.createForOwner(
        ownerIds[0],
        requestId,
        snapshot("Łódź", "2026-06-10T13:00:00.000Z", "low"),
      ),
    ).rejects.toBeInstanceOf(SymptomCheckRequestConflictError);
  });

  it("treats completion time as canonical content by default", async () => {
    const requestId = randomUUID();
    await repository.createForOwner(
      ownerIds[0],
      requestId,
      snapshot("Katowice", "2026-06-10T13:00:00.000Z"),
    );

    await expect(
      repository.createForOwner(
        ownerIds[0],
        requestId,
        snapshot("Katowice", "2026-06-10T13:01:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(SymptomCheckRequestConflictError);
  });

  it("inserts only after the explicit authenticated save action", async () => {
    const ownerId = ownerIds[0];
    const [before] = await database
      .select({ value: count() })
      .from(schema.symptomChecks)
      .where(eq(schema.symptomChecks.ownerId, ownerId));
    const currentPollenAction = createCurrentPollenAction({
      geocode: async () => ({
        status: "ok",
        city: {
          placeId: "place-wroclaw",
          label: "Wrocław, Polska",
          latitude: 51.1079,
          longitude: 17.0385,
          country: "Polska",
        },
      }),
      lookupPollen: async () => ({
        status: "ok",
        pollenActivity: {
          "grass-pollen": "high",
          "tree-pollen": "moderate",
          "weed-pollen": "low",
          "ragweed-pollen": "unknown",
        },
      }),
    });
    const pollenResponse = await currentPollenAction(
      new Request("http://localhost/api/current-pollen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: "place-wroclaw" }),
      }),
    );
    const completedCheck = snapshot(
      "Wrocław",
      "2026-06-10T14:00:00.000Z",
    );
    const [afterCompletion] = await database
      .select({ value: count() })
      .from(schema.symptomChecks)
      .where(eq(schema.symptomChecks.ownerId, ownerId));

    expect(pollenResponse.status).toBe(200);
    expect(afterCompletion?.value).toBe(before?.value);

    const action = createSaveSymptomCheckAction({
      appOrigin: "https://allergen.example",
      sessions: {
        requireUser: async () => ({
          id: ownerId,
          providerUid: "integration-provider",
          email: "integration@example.test",
          normalizedEmail: "integration@example.test",
        }),
      },
      repository,
      originValidator: () => true,
      now: () => new Date("2026-06-11T12:00:00.000Z"),
    });
    const response = await action(
      new Request("https://allergen.example/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          requestId: randomUUID(),
          source: "direct",
          snapshot: JSON.stringify(completedCheck),
        }),
      }),
    );
    const [afterSave] = await database
      .select({ value: count() })
      .from(schema.symptomChecks)
      .where(eq(schema.symptomChecks.ownerId, ownerId));

    expect(response.status).toBe(302);
    expect(afterSave?.value).toBe((before?.value ?? 0) + 1);
  });

  it("reset migration deletes symptom checks while preserving users", async () => {
    const ownerId = ownerIds[0];
    await repository.createForOwner(
      ownerId,
      randomUUID(),
      mixedSnapshot("Rzeszów", "2026-06-11T15:00:00.000Z"),
    );
    const resetSql = await readFile(
      "drizzle/0002_reset_symptom_checks_for_current_v2.sql",
      "utf8",
    );

    await pool.query(resetSql);

    const [remainingChecks] = await database
      .select({ value: count() })
      .from(schema.symptomChecks);
    const [remainingOwner] = await database
      .select({ value: count() })
      .from(schema.users)
      .where(eq(schema.users.id, ownerId));

    expect(remainingChecks?.value).toBe(0);
    expect(remainingOwner?.value).toBe(1);
  });
});
