import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { rateLimit } from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

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
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }),
);

function parseCorsOrigin(): cors.CorsOptions["origin"] {
  if (process.env.NODE_ENV !== "production") return true;
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    // Fail-closed in production. Reflective `Access-Control-Allow-Origin: *`
    // combined with credentials: true is a footgun, so refuse to start until
    // the operator has set CORS_ORIGIN explicitly.
    logger.error("CORS_ORIGIN must be set in production (comma-separated list of allowed origins)");
    process.exit(1);
  }
  const allowList = raw.split(",").map((o) => o.trim()).filter(Boolean);
  if (allowList.length === 0) {
    logger.error("CORS_ORIGIN is empty after parsing");
    process.exit(1);
  }
  return allowList.length === 1 ? allowList[0] : allowList;
}

app.use(
  cors({
    origin: parseCorsOrigin(),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

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

app.use(globalLimiter);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/refresh", authLimiter);
app.use("/api/auth/change-password", authLimiter);
app.use("/api/auth/update-phone", authLimiter);
app.use("/api/users/:id/reset-password", authLimiter);
app.use("/api/imports", authLimiter);
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
  logger.error({ err }, "Unhandled error");
  const isProd = process.env.NODE_ENV === "production";
  res.status(500).json({
    error: "Internal server error",
    message: isProd ? "حدث خطأ داخلي، يرجى المحاولة لاحقاً" : err.message,
  });
});

export default app;
