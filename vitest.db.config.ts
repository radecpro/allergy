import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./app", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "app/**/*-repository.integration.test.ts",
      "app/**/*-route-handlers.integration.test.ts",
    ],
    fileParallelism: false,
  },
});
