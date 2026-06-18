import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { inArray } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "~/db/schema.server";

import { createSymptomCheckRepository } from "./symptom-check-repository.server";

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
});
