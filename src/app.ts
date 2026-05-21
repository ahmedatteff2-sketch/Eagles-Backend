import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import * as Sentry from "@sentry/node";
import { pinoHttp } from "pino-http";
import { rateLimit } from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { auditMiddleware } from "./middlewares/audit.js";
import { normalizePhone } from "./lib/phone.js";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // No inline scripts: the SPA bundles its scripts so 'unsafe-inline'
        // would only weaken the policy without enabling any current usage.
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        // YouTube serves video thumbnails from i.ytimg.com / i9.ytimg.com.
        imgSrc: ["'self'", "data:", "blob:", "https://i.ytimg.com", "https://i9.ytimg.com"],
        connectSrc: ["'self'"],
        // Allow embedded YouTube + Vimeo players for the in-app exercise video
        // library. Anything else (raw <video src>, etc.) is unaffected.
        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
          "https://player.vimeo.com",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);

function parseCorsOrigin(): cors.CorsOptions["origin"] | null {
  // Dev: prefer an explicit CORS_ORIGIN_DEV whitelist (recommended); fall back
  // to reflecting any origin only if it's not set. The reflective fallback
  // remains so existing dev setups don't break, but the warning nudges
  // operators toward configuring a list — same model as production.
  if (process.env.NODE_ENV !== "production") {
    const devRaw = process.env.CORS_ORIGIN_DEV;
    if (devRaw) {
      const list = devRaw
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      if (list.length === 0) return true;
      return list.length === 1 ? list[0] : list;
    }
    return true;
  }
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    // No CORS_ORIGIN set in production. Don't crash — instead skip the CORS
    // middleware entirely. Same-origin requests (frontend served from this
    // same Express app) still work; cross-origin requests are blocked by the
    // browser by default, which is the safe behavior. This is intentionally
    // NOT a fallback to `origin: true` (reflective) — reflective + credentials
    // is the footgun we are avoiding.
    logger.warn(
      "CORS_ORIGIN not set — same-origin only mode (set CORS_ORIGIN to a comma-separated list of allowed origins to enable cross-origin requests)",
    );
    return null;
  }
  const allowList = raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (allowList.length === 0) {
    logger.warn("CORS_ORIGIN is empty after parsing — running in same-origin only mode");
    return null;
  }
  return allowList.length === 1 ? allowList[0] : allowList;
}

const corsOrigin = parseCorsOrigin();
if (corsOrigin !== null) {
  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }),
  );
}

const isDev = process.env.NODE_ENV !== "production";

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests", message: "حاول مرة أخرى بعد 15 دقيقة" },
  skip: (req) => req.method === "OPTIONS",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many login attempts", message: "تم تجاوز الحد المسموح به. حاول بعد 15 دقيقة" },
  skip: isDev
    ? (req) => {
        const ip = req.ip ?? "";
        return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("::ffff:127.");
      }
    : undefined,
});

/**
 * Per-phone limiter for /auth/login. Layered *in addition to* the IP-based
 * limiter so a single attacker behind one IP can't spread attempts across
 * many accounts, AND a distributed attacker (botnet) can't focus all attempts
 * on a single victim's account.
 *
 * Key extraction is best-effort: if the body has no phone (e.g. malformed
 * request) we fall back to the IP, which is what the IP limiter already
 * covers — so a missing phone simply doesn't add per-phone protection.
 */
const loginPerPhoneLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 50 : 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many login attempts",
    message: "تم تجاوز الحد المسموح به لهذا الرقم. حاول بعد 15 دقيقة",
  },
  keyGenerator: (req) => {
    const raw = (req.body as { phone?: unknown } | undefined)?.phone;
    if (typeof raw === "string" && raw.length > 0 && raw.length <= 32) {
      const normalized = normalizePhone(raw);
      if (normalized) return `phone:${normalized}`;
    }
    return `ip:${req.ip ?? "unknown"}`;
  },
});

app.use(globalLimiter);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Login: IP limiter first (cheap, blocks IP-floods), then per-phone limiter
// (slightly more expensive — has to read req.body — but blocks distributed
// attacks against a single account).
app.use("/api/auth/login", authLimiter, loginPerPhoneLimiter);
app.use("/api/auth/2fa/verify", authLimiter);
app.use("/api/auth/refresh", authLimiter);
app.use("/api/auth/change-password", authLimiter);
app.use("/api/auth/update-phone", authLimiter);
app.use("/api/auth/2fa/setup", authLimiter);
app.use("/api/auth/2fa/enable", authLimiter);
app.use("/api/auth/2fa/disable", authLimiter);
app.use("/api/users/:id/reset-password", authLimiter);
app.use("/api/imports", authLimiter, express.json({ limit: "3mb" }));
// Audit middleware records every state-changing API request for compliance
// review. Mounted under /api so the SPA / static asset paths above don't
// generate audit churn.
app.use("/api", auditMiddleware);
app.use("/api", router);

// Any /api/* path that the router didn't match is genuinely unknown — return
// JSON instead of falling through to the SPA index.html below (which would
// confuse API clients with an HTML 200).
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found", message: "المسار غير موجود" });
});

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // dist/index.mjs is in dist/ — public is one level up at root
  const frontendPath = path.resolve(__dirname, "..", "public");

  if (existsSync(frontendPath)) {
    // Cache JS/CSS/images for 7 days (they have hashed filenames)
    app.use(express.static(frontendPath, { maxAge: "7d", immutable: true }));
    // Never cache index.html — always serve fresh
    app.get(/.*/, (_req: Request, res: Response) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(frontendPath, "index.html"));
    });
    logger.info({ frontendPath }, "Serving frontend static files");
  } else {
    logger.warn({ frontendPath }, "Frontend public folder not found");
  }
}

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  // Forward to Sentry first so the breadcrumb trail captured up to this
  // point is correlated with the exception. Sentry is a no-op when DSN
  // is unset, so this is safe in dev/test.
  Sentry.captureException(err);
  logger.error({ err }, "Unhandled error");
  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "Internal server error",
    message: isProd ? "حدث خطأ داخلي، يرجى المحاولة لاحقاً" : err.message,
  });
});

export default app;
