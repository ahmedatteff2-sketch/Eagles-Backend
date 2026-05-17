/**
 * Frontend Sentry wiring. Initialized from `main.tsx` early so any error
 * raised during root render is captured. Does nothing if the build doesn't
 * have `VITE_SENTRY_DSN` set, so dev/test/local previews don't pollute the
 * Sentry project with noise.
 */
import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) ?? undefined,
    // Performance: keep sample rate low to fit comfortably in the free tier.
    // Override via env per-deploy if you've upgraded the plan.
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Don't ship PII by default. The auth flow already redacts tokens server-
    // side, but `sendDefaultPii: false` makes sure stack-trace breadcrumbs
    // can't leak the user's IP / cookies.
    sendDefaultPii: false,
  });
  initialized = true;
}

/**
 * Thin wrapper around `Sentry.captureException` so route components / hooks
 * don't have to import the SDK directly. When Sentry is disabled this is a
 * no-op, preserving the same call site whether or not telemetry is on.
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!initialized) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
