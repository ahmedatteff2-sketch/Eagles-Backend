import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

// `mode === "analyze"` is set by `npm run analyze` (see package.json). When
// it is, we mount rollup-plugin-visualizer so the build emits an interactive
// treemap of the chunk graph at dist/stats.html — handy for spotting
// surprise dependencies pulled in via transitive imports.
export default defineConfig(({ mode }) => {
  const isAnalyze = mode === "analyze";

  const plugins: PluginOption[] = [
    react(),
    tailwindcss(),
    // PWA: replaces the hand-rolled public/sw.js. Workbox precaches the build
    // output (everything in `globPatterns`) and uses runtime caching for the
    // JSON API + Google Fonts. `registerType: "autoUpdate"` makes the SW pull
    // a fresh manifest on every page load; coupled with `clientsClaim`, users
    // see the new version on the next navigation rather than after closing
    // every tab.
    VitePWA({
      registerType: "autoUpdate",
      strategies: "generateSW",
      injectRegister: "auto",
      // Keep the existing `manifest.json` source of truth in public/ (Capacitor
      // also reads it). vite-plugin-pwa will copy / merge as needed.
      manifest: false,
      includeAssets: [
        "favicon.svg",
        "eagle-gym-logo.jpg",
        "manifest.json",
        "opengraph.jpg",
      ],
      workbox: {
        // Precache JS / CSS / fonts from the build. We deliberately exclude
        // the source-map files since they're huge and only useful in DevTools.
        globPatterns: ["**/*.{js,css,html,svg,jpg,png,webp,woff,woff2}"],
        // The SPA shell: any unmatched navigation request gets index.html so
        // the client router can take over. Stale-while-revalidate keeps the
        // shell responsive even on flaky networks.
        navigateFallback: "/index.html",
        // Don't try to cache /api/* — they're authenticated and must always
        // hit the network. /landing/* is the standalone marketing site (its
        // own build) so the SPA shell must never be served in its place.
        navigateFallbackDenylist: [/^\/api\//, /^\/landing/],
        runtimeCaching: [
          {
            // Google Fonts CSS — small, infrequently changed.
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "google-fonts-css" },
          },
          {
            // Font files themselves — cache forever, hashed names.
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
        // Skip waiting + clientsClaim so the new SW activates on next reload
        // instead of waiting for every tab to close.
        skipWaiting: true,
        clientsClaim: true,
      },
      devOptions: { enabled: false },
    }),
  ];

  if (isAnalyze) {
    plugins.push(
      visualizer({
        filename: "dist/stats.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }) as unknown as PluginOption,
    );
  }

  return {
    base: "/",
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@workspace/api-client-react": path.resolve(__dirname, "src/api-client"),
      },
      dedupe: ["react", "react-dom"],
    },
    server: {
      port: 5173,
      host: "0.0.0.0",
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "../public",
      emptyOutDir: true,
      sourcemap: false,
      // Vendor splitting — keeps the main entry chunk small so the login
      // page renders fast, while heavy libraries that aren't used on the
      // login screen (recharts, jsPDF, the QR libs, all Radix primitives)
      // sit in their own cacheable chunks.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("react-dom") || id.match(/[\\/]react[\\/]/)) return "react";
            if (id.includes("@tanstack")) return "tanstack";
            if (id.includes("@radix-ui")) return "radix";
            if (id.includes("recharts") || id.includes("d3-")) return "charts";
            if (id.includes("jspdf") || id.includes("jspdf-autotable")) return "pdf";
            if (id.includes("jsqr") || id.includes("qrcode.react")) return "qr";
            if (id.includes("framer-motion")) return "motion";
            if (id.includes("date-fns")) return "date";
            if (id.includes("lucide-react") || id.includes("react-icons")) return "icons";
            if (id.includes("@sentry")) return "sentry";
            if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
            return undefined;
          },
        },
      },
    },
    // Strip `console.*` and `debugger` from production builds so logs don't
    // leak member PII / auth flow details in the shipped bundle.
    esbuild: {
      drop: process.env.NODE_ENV === "production" ? ["console", "debugger"] : [],
    },
  };
});
