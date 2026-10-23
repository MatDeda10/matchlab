import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["engine/**/*.test.ts", "lib/**/*.test.ts", "tests/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["engine/**/*.ts", "lib/**/*.ts"],
      exclude: ["**/*.test.ts", "lib/db/**"],
    },
  },
});
