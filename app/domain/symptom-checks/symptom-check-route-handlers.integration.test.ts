import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { count, eq, inArray } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "~/db/schema.server";
import type { LocalUser } from "~/domain/auth/types";
import { createCurrentLocationAction } from "~/routes/api.current-location";
import { createCurrentPollenAction } from "~/routes/api.current-pollen";

import { buildCurrentSymptomSnapshot } from "./snapshot";
import { createSymptomCheckRepository } from "./symptom-check-repository.server";
import {
  createSaveSymptomCheckAction,
  createSymptomCheckDetailAction,
  createSymptomCheckDetailLoader,
  createSymptomCheckListLoader,
} from "./symptom-check-route-handlers.server";
import type { SymptomCheckListLoaderData } from "./symptom-check-route-handlers.server";

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
const appOrigin = "https://allergen.example";

function localUser(id: string, label: string): LocalUser {
  return {
    id,
    providerUid: `provider-${label}`,
    email: `${label}@example.test`,
    normalizedEmail: `${label}@example.test`,
  };
}

function snapshot(cityLabel: string, completedAt: string) {
  return buildCurrentSymptomSnapshot({
    city: {
      placeId: `place-${cityLabel.toLowerCase()}`,
      label: cityLabel,
    },
    symptoms: [
      { symptomId: "sneezing", intensity: "high" },
      { symptomId: "itchy-eyes", intensity: "high" },
    ],
    pollenActivity: {
      "grass-pollen": "high",
      "tree-pollen": "moderate",
    },
    completedAt: new Date(completedAt),
  });
}

function detailRequest(body: URLSearchParams) {
  return new Request(`${appOrigin}/history/foreign-check`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: appOrigin,
    },
    body,
  });
}

function postJson(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function symptomCheckCount() {
  const [row] = await database.select({ value: count() }).from(schema.symptomChecks);

  return row?.value ?? 0;
}

async function expectPrivateNotFound(operation: Promise<Response>) {
  try {
    await operation;
    throw new Error("Expected a private not-found response.");
  } catch (error) {
    expect(error).toBeInstanceOf(Response);
    expect((error as Response).status).toBe(404);
    expect((error as Response).headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
  }
}

beforeAll(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });

  const inserted = await database
    .insert(schema.users)
    .values([
      {
        identityPlatformUid: `route-handlers-a-${randomUUID()}`,
        email: `route-handlers-a-${randomUUID()}@example.test`,
        normalizedEmail: `route-handlers-a-${randomUUID()}@example.test`,
      },
      {
        identityPlatformUid: `route-handlers-b-${randomUUID()}`,
        email: `route-handlers-b-${randomUUID()}@example.test`,
        normalizedEmail: `route-handlers-b-${randomUUID()}@example.test`,
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

describe("PostgreSQL symptom-check route handlers", () => {
  it("runs with disposable database fixtures for two authenticated owners", () => {
    expect(ownerIds).toHaveLength(2);
    expect(repository).toBeDefined();
  });

  it("keeps User A's saved check private from User B list, read, update, and delete attempts", async () => {
    const [ownerA, ownerB] = ownerIds;
    const userB = localUser(ownerB, "route-handlers-b");
    const ownerRecord = await repository.createForOwner(
      ownerA,
      randomUUID(),
      snapshot("Warszawa", "2026-06-18T12:00:00.000Z"),
    );
    const before = await database.query.symptomChecks.findFirst({
      where: eq(schema.symptomChecks.id, ownerRecord.id),
    });
    const dependencies = {
      appOrigin,
      sessions: { requireUser: async () => userB },
      repository,
      originValidator: () => true,
    };
    const listLoader = createSymptomCheckListLoader(dependencies);
    const detailLoader = createSymptomCheckDetailLoader(dependencies);
    const detailAction = createSymptomCheckDetailAction(dependencies);

    const listResponse = await listLoader(new Request(`${appOrigin}/history`));
    const listPayload =
      (await listResponse.json()) as SymptomCheckListLoaderData;

    expect(listResponse.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect(listPayload.records.map((record) => record.id)).not.toContain(
      ownerRecord.id,
    );

    await expectPrivateNotFound(
      detailLoader(
        new Request(`${appOrigin}/history/${ownerRecord.id}`),
        ownerRecord.id,
      ),
    );
    await expectPrivateNotFound(
      detailAction(
        detailRequest(
          new URLSearchParams({
            intent: "update",
            symptoms: JSON.stringify([
              { symptomId: "blocked-nose", intensity: "low" },
            ]),
          }),
        ),
        ownerRecord.id,
      ),
    );
    await expectPrivateNotFound(
      detailAction(
        detailRequest(new URLSearchParams({ intent: "delete" })),
        ownerRecord.id,
      ),
    );

    const after = await database.query.symptomChecks.findFirst({
      where: eq(schema.symptomChecks.id, ownerRecord.id),
    });

    expect(before).toBeDefined();
    expect(after).toEqual(before);
    expect(after).toMatchObject({
      id: ownerRecord.id,
      ownerId: ownerA,
      symptoms: ownerRecord.snapshot.symptoms,
    });
  });

  it("does not persist public current pollen or device-location lookups before explicit authenticated save", async () => {
    const ownerId = ownerIds[0];
    const completedCheck = snapshot(
      "Wrocław",
      "2026-06-18T14:00:00.000Z",
    );
    const currentPollenAction = createCurrentPollenAction({
      geocode: async (placeId) => ({
        status: "ok",
        city: {
          placeId,
          label: "Wrocław, Polska",
          mainText: "Wrocław",
          latitude: 51.1079,
          longitude: 17.0385,
          country: "Polska",
          isPolandPriority: true,
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
    const currentLocationAction = createCurrentLocationAction({
      resolveCity: async () => ({
        status: "ok",
        city: {
          placeId: "place-wroclaw",
          label: "Wrocław, Polska",
          mainText: "Wrocław",
          latitude: 51.1079,
          longitude: 17.0385,
          country: "Polska",
          isPolandPriority: true,
        },
      }),
    });
    const beforeCurrentPollen = await symptomCheckCount();

    const currentPollenResponse = await currentPollenAction(
      postJson("/api/current-pollen", { placeId: "place-wroclaw" }),
    );
    const afterCurrentPollen = await symptomCheckCount();

    expect(currentPollenResponse.status).toBe(200);
    expect(afterCurrentPollen).toBe(beforeCurrentPollen);

    const beforeLocationFlow = await symptomCheckCount();
    const currentLocationResponse = await currentLocationAction(
      postJson("/api/current-location", {
        latitude: 51.1079,
        longitude: 17.0385,
      }),
    );
    const selectedCity = await currentLocationResponse.json();
    const selectedPollenResponse = await currentPollenAction(
      postJson("/api/current-pollen", {
        placeId: selectedCity.city.placeId,
      }),
    );
    const afterLocationFlow = await symptomCheckCount();

    expect(currentLocationResponse.status).toBe(200);
    expect(selectedPollenResponse.status).toBe(200);
    expect(afterLocationFlow).toBe(beforeLocationFlow);

    const saveAction = createSaveSymptomCheckAction({
      appOrigin,
      sessions: {
        requireUser: async () => localUser(ownerId, "route-handlers-save"),
      },
      repository,
      originValidator: () => true,
      now: () => new Date("2026-06-18T15:00:00.000Z"),
    });
    const beforeSave = await symptomCheckCount();
    const saveResponse = await saveAction(
      new Request(`${appOrigin}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: appOrigin,
        },
        body: new URLSearchParams({
          requestId: randomUUID(),
          source: "direct",
          snapshot: JSON.stringify(completedCheck),
        }),
      }),
    );
    const afterSave = await symptomCheckCount();

    expect(saveResponse.status).toBe(302);
    expect(saveResponse.headers.get("Location")).toMatch(
      /^\/history\/[0-9a-f-]+\?saved=1&requestId=[0-9a-f-]+$/,
    );
    expect(afterSave).toBe(beforeSave + 1);
  });
});
