import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config mirrors the path aliases used by tsx + esbuild so the same
// import specifiers (`@workspace/db`, etc.) resolve in tests too.
export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    // Each suite gets its own DB transaction; serialize so they don't fight
    // over the shared `eagles_test` schema.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["**/*.test.ts", "src/scripts/**", "build.mjs", "drizzle/**", "client/**"],
    },
  },
  resolve: {
    alias: {
      "@workspace/db": path.resolve(__dirname, "src/db/index.ts"),
      "@workspace/db/schema": path.resolve(__dirname, "src/db/schema/index.ts"),
      "@workspace/api-zod": path.resolve(__dirname, "src/api-zod/index.ts"),
    },
  },
});
