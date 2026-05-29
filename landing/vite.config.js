import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The marketing landing page is built as an isolated sub-app so its
// Tailwind v3 design system stays fully decoupled from the main client
// (Tailwind v4). It is served from `/landing/` and emitted into the API's
// `public/landing/` folder after the main client build.
export default defineConfig({
  base: "/landing/",
  plugins: [react()],
  build: {
    outDir: "../public/landing",
    emptyOutDir: true,
  },
});
