/**
 * Sentry initialization for the backend. Imported with side effects from
 * `index.ts` BEFORE any other module so request handlers and Express
 * routes pick up the auto-instrumented spans.
 *
 * Sentry is no-op'd when `SENTRY_DSN` is not set, so local development and
 * the test suite work without any extra configuration.
 */
import * as Sentry from "@sentry/node";
import { logger } from "./logger.js";

const dsn = process.env.SENTRY_DSN;
const enabled = Boolean(dsn);

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT ?? undefined,
    // 0.1 == 10% of transactions sampled. Bump on Render free tier only if
    // you've upgraded the Sentry plan; the free tier caps events quickly.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    // Don't send PII by default (Sentry would otherwise capture IP + user
    // agent from `req`). The audit log already covers operator actions.
    sendDefaultPii: false,
  });
  logger.info("Sentry initialized");
} else {
  logger.debug("Sentry disabled (SENTRY_DSN not set)");
}

export { Sentry, enabled as sentryEnabled };
