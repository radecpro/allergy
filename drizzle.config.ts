import { defineConfig } from "drizzle-kit";

const generationOnlyUrl =
  "postgresql://migration:unused@127.0.0.1:5432/allergen_finder";

export default defineConfig({
  dialect: "postgresql",
  schema: "./app/db/schema.server.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? generationOnlyUrl,
  },
});
