import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

// `__dirname` isn't defined when this config is loaded as ESM, so derive it
// from `import.meta.url` like build.mjs does.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vitest config mirrors the path aliases used by tsx + esbuild so the same
// import specifiers (`@workspace/db`, etc.) resolve in tests too.
//
// IMPORTANT: we use the array form with regex `find` patterns instead of a
// plain object. With the object form Vite does *prefix* matching, so
// `@workspace/db` matches `@workspace/db/schema` first and rewrites the
// specifier to `<src/db/index.ts>/schema` — which doesn't exist and
// breaks the test loader with a misleading "Cannot find module" error.
// Regex patterns anchored with `$` force an exact match per alias.
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
    alias: [
      {
        find: /^@workspace\/db\/schema$/,
        replacement: path.resolve(__dirname, "src/db/schema/index.ts"),
      },
      {
        find: /^@workspace\/db$/,
        replacement: path.resolve(__dirname, "src/db/index.ts"),
      },
      {
        find: /^@workspace\/api-zod$/,
        replacement: path.resolve(__dirname, "src/api-zod/index.ts"),
      },
    ],
  },
});
