/**
 * Centralized localStorage / sessionStorage keys.
 * Keep all string keys here so we can audit usage and avoid typos.
 */

export const STORAGE_KEYS = {
  AUTH: "gym-auth-storage",
  THEME_LEGACY: "theme",
  THEME_GYM: "gym-theme",
  GYM_SETTINGS: "gym-settings",
  PWA_DISMISSED: "pwa-install-dismissed",
  PUSH_ENABLED: "push-enabled",
  REDIRECT_AFTER_LOGIN: "post-login-redirect",
  SPLASH_DONE: "splash-done",
} as const;

export function memberNotesKey(userId: number | string): string {
  return `member-notes-${userId}`;
}

/**
 * Safely read and parse a JSON value from localStorage. Returns the fallback
 * (default `null`) on missing key, malformed JSON, or unavailable storage.
 */
export function readJSON<T>(key: string, fallback: T | null = null): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or disabled — ignore */
  }
}

export function readString(key: string, fallback = ""): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
