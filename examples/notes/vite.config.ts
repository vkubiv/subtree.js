import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The examples compile the three packages from source, so they never run against a
// stale build. An app outside this repository just installs the packages.
const pkg = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^subtree\.js\/core$/, replacement: pkg("subtree/src/core/index.ts") },
      { find: /^subtree\.js\/react$/, replacement: pkg("subtree/src/react/index.ts") },
      { find: /^subtree\.js$/, replacement: pkg("subtree/src/index.ts") },
      { find: /^trunk\.js$/, replacement: pkg("trunk/src/index.ts") },
      { find: /^operation-result\.js$/, replacement: pkg("operation-result/src/index.ts") },
    ],
  },
  test: {
    name: "example-notes",
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    globals: true,
  },
});
