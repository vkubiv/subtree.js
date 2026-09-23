import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "subtree",
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
    typecheck: { enabled: true, include: ["src/**/*.test.{ts,tsx}"] },
  },
});
