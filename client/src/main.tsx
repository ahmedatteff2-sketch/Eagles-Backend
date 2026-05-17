import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import {
  setAuthTokenGetter,
  setAuthRefreshHandler,
  setUnauthorizedHandler,
  setBaseUrl,
} from "./api-client";
import { STORAGE_KEYS } from "./lib/storage";
import { initSentry } from "./lib/sentry";
// Initialize i18n for its side effects (registers resources with i18next).
import "./i18n";

// Initialize Sentry before React renders so the very first paint is
// covered. No-op when VITE_SENTRY_DSN isn't set.
initSentry();

const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME_LEGACY) ?? "dark";
document.documentElement.classList.add(savedTheme);
// `dir` and `lang` attributes are managed by i18n (see src/i18n/index.ts).

// Service worker registration is handled by vite-plugin-pwa's
// `injectRegister: "auto"` — see vite.config.ts. We no longer hand-roll a
// /sw.js: Workbox handles precaching, runtime caching, and update flow.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>;
}

// PWA install prompt
let deferredPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e as BeforeInstallPromptEvent;
  window.dispatchEvent(new CustomEvent("pwa-installable"));
});
(window as unknown as { __pwaInstall?: () => void }).__pwaInstall = () => {
  if (deferredPrompt) { void deferredPrompt.prompt(); deferredPrompt = null; }
};

// ─── API Base URL (set VITE_API_URL env var when frontend & backend are on different domains)
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) setBaseUrl(apiUrl.replace(/\/+$/, ""));

// ─── Token helpers ────────────────────────────────────────────────────────────

function decodeExp(token: string): number | null {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(b64);
    const payload = JSON.parse(json);
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

interface PersistedAuthState {
  accessToken: string;
  refreshToken: string;
}

function getStoredState(): PersistedAuthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (!raw) return null;
    const state = (JSON.parse(raw) as { state?: Partial<PersistedAuthState> })?.state;
    if (!state?.accessToken || !state?.refreshToken) return null;
    return { accessToken: state.accessToken, refreshToken: state.refreshToken };
  } catch {
    return null;
  }
}

function updateStoredTokens(accessToken: string, refreshToken: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (!raw) return;
    const obj = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (obj?.state) {
      obj.state.accessToken = accessToken;
      obj.state.refreshToken = refreshToken;
      localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(obj));
    }
  } catch {
    /* ignore */
  }
}

function clearAndRedirect(): void {
  // Preserve current path so we can restore after re-login.
  try {
    const here = window.location.pathname + window.location.search;
    if (here && !here.startsWith("/login")) {
      sessionStorage.setItem(STORAGE_KEYS.REDIRECT_AFTER_LOGIN, here);
    }
  } catch {
    /* ignore */
  }
  localStorage.removeItem(STORAGE_KEYS.AUTH);
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}

// ─── Auto-refresh coordination ────────────────────────────────────────────────

let isRefreshing = false;
let pendingRefresh: Promise<string | null> | null = null;

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const base = apiUrl ? apiUrl.replace(/\/+$/, "") : "";
    const res = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PersistedAuthState>;
    if (data?.accessToken && data?.refreshToken) {
      updateStoredTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    }
    return null;
  } catch {
    return null;
  }
}

function startRefresh(): Promise<string | null> {
  const state = getStoredState();
  if (!state) return Promise.resolve(null);
  if (isRefreshing && pendingRefresh) return pendingRefresh;
  isRefreshing = true;
  pendingRefresh = refreshAccessToken(state.refreshToken).finally(() => {
    isRefreshing = false;
    pendingRefresh = null;
  });
  return pendingRefresh;
}

// ─── Auth wiring on the API client ──────────────────────────────────────────

setAuthTokenGetter(async () => {
  const state = getStoredState();
  if (!state) return null;

  const { accessToken } = state;
  const exp = decodeExp(accessToken);

  // Use existing token if it's still good for >60s.
  if (exp !== null && exp * 1000 > Date.now() + 60_000) {
    return accessToken;
  }

  const refreshed = await startRefresh();
  if (!refreshed) {
    clearAndRedirect();
    return null;
  }
  return refreshed;
});

// On 401 from any API call, try to refresh once and let customFetch retry.
setAuthRefreshHandler(async () => {
  return startRefresh();
});

// If refresh fails (or no refresh token), force re-login.
setUnauthorizedHandler(() => {
  clearAndRedirect();
});

// ─── Cross-tab logout: react when auth storage is cleared in another tab ─────
window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEYS.AUTH && e.newValue == null) {
    if (window.location.pathname !== "/login") {
      window.location.replace("/login");
    }
  }
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

