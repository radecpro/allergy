import { eq } from "drizzle-orm";

import { getDatabase, type Database } from "~/db/client.server";
import { users } from "~/db/schema.server";

import type { LocalUser, ProviderIdentity, UserRepository } from "./types";

function toLocalUser(row: typeof users.$inferSelect): LocalUser {
  return {
    id: row.id,
    providerUid: row.identityPlatformUid,
    email: row.email,
    normalizedEmail: row.normalizedEmail,
  };
}

export function createUserRepository(
  database: Database = getDatabase(),
): UserRepository {
  return {
    async upsertProviderUser(identity: ProviderIdentity) {
      const normalizedEmail = identity.email.trim().toLowerCase();
      const [row] = await database
        .insert(users)
        .values({
          identityPlatformUid: identity.providerUid,
          email: identity.email,
          normalizedEmail,
        })
        .onConflictDoUpdate({
          target: users.identityPlatformUid,
          set: {
            email: identity.email,
            normalizedEmail,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!row) {
        throw new Error("Local user upsert returned no record.");
      }

      return toLocalUser(row);
    },

    async findByProviderUid(providerUid: string) {
      const [row] = await database
        .select()
        .from(users)
        .where(eq(users.identityPlatformUid, providerUid))
        .limit(1);

      return row ? toLocalUser(row) : null;
    },
  };
}
