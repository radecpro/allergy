import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { users } from "~/db/schema.server";

import { createUserRepository } from "./user-repository.server";

const connectionString = process.env.TEST_DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "TEST_DATABASE_URL is required and must reference a disposable PostgreSQL database.",
  );
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 5_000,
});
const database = drizzle(pool, { schema: { users } });
const repository = createUserRepository(database);
const testProviderUids: string[] = [];

beforeAll(async () => {
  await migrate(database, { migrationsFolder: "drizzle" });
});

afterAll(async () => {
  if (testProviderUids.length > 0) {
    await database
      .delete(users)
      .where(eq(users.identityPlatformUid, testProviderUids[0]));
  }
  await pool.end();
});

describe("PostgreSQL user repository", () => {
  it("keeps one stable user id and synchronizes canonical email fields", async () => {
    const providerUid = `integration-${randomUUID()}`;
    testProviderUids.push(providerUid);

    const created = await repository.upsertProviderUser({
      providerUid,
      email: "First.Email@Example.com",
    });
    const updated = await repository.upsertProviderUser({
      providerUid,
      email: "Updated.Email@Example.com",
    });
    const found = await repository.findByProviderUid(providerUid);

    expect(updated.id).toBe(created.id);
    expect(updated.email).toBe("Updated.Email@Example.com");
    expect(updated.normalizedEmail).toBe("updated.email@example.com");
    expect(found).toEqual(updated);
  });
});
