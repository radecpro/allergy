import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.server";

const DATABASE_POOL_MAX = 3;
const CONNECTION_TIMEOUT_MS = 5_000;
const IDLE_TIMEOUT_MS = 30_000;
const QUERY_TIMEOUT_MS = 10_000;
const STATEMENT_TIMEOUT_MS = 8_000;
const LOCK_TIMEOUT_MS = 2_000;

export type Database = ReturnType<typeof drizzle<typeof schema>>;

let database: Database | undefined;
let pool: Pool | undefined;

export function getDatabase(): Database {
  if (database) {
    return database;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to access PostgreSQL.");
  }

  pool = new Pool({
    connectionString,
    max: DATABASE_POOL_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: STATEMENT_TIMEOUT_MS,
    lock_timeout: LOCK_TIMEOUT_MS,
    allowExitOnIdle: true,
  });
  pool.on("error", () => {
    console.error("An idle PostgreSQL client failed.");
  });

  database = drizzle(pool, { schema });
  return database;
}

export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = undefined;
  database = undefined;
}
