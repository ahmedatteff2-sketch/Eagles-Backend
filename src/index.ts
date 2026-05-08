import app from "./app.js";
import { logger } from "./lib/logger.js";
import { runMigrations } from "./db/migrate.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

try {
  await runMigrations();
} catch (err) {
  logger.error({ err }, "Migration failed — exiting");
  process.exit(1);
}

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

// Graceful shutdown — give in-flight requests up to 10 seconds to finish, then
// force-exit. Without this, container orchestrators (Fly, Render, k8s) end up
// SIGKILL'ing requests mid-flight, which corrupts in-progress writes and
// surfaces as random 502s during deploys.
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Received shutdown signal — closing server");

  const forceExitTimer = setTimeout(() => {
    logger.warn({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, "Force-exiting after shutdown timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  // Allow Node to exit even while this timer is queued, so the process can
  // exit cleanly the moment server.close() resolves.
  forceExitTimer.unref();

  server.close((closeErr) => {
    if (closeErr) {
      logger.error({ err: closeErr }, "Error closing HTTP server");
      process.exit(1);
    }
    logger.info("HTTP server closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

process.on("unhandledRejection", (reason) => {
  logger.error({ reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception — exiting");
  // Process is in an undefined state; do not try to keep serving traffic.
  process.exit(1);
});
