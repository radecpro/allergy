import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  SavedPollenActivity,
  SavedSymptomEntry,
} from "~/domain/symptom-checks/types";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  identityPlatformUid: text("identity_platform_uid").notNull().unique(),
  email: text("email").notNull(),
  normalizedEmail: text("normalized_email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const symptomChecks = pgTable(
  "symptom_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),
    clientRequestId: uuid("client_request_id").notNull(),
    snapshotFingerprint: text("snapshot_fingerprint").notNull(),
    snapshotVersion: integer("snapshot_version").notNull(),
    rankingVersion: text("ranking_version").notNull(),
    cityPlaceId: text("city_place_id").notNull(),
    cityLabel: text("city_label").notNull(),
    symptoms: jsonb("symptoms").$type<SavedSymptomEntry[]>().notNull(),
    pollenActivity: jsonb("pollen_activity")
      .$type<SavedPollenActivity>()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("symptom_checks_owner_completed_at_idx").on(
      table.ownerId,
      table.completedAt,
    ),
    uniqueIndex("symptom_checks_owner_request_id_unique").on(
      table.ownerId,
      table.clientRequestId,
    ),
  ],
);
