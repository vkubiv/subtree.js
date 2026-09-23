import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "trunk",
    include: ["src/**/*.test.ts"],
    environment: "node",
    typecheck: { enabled: true, include: ["src/**/*.test.ts"] },
  },
});
