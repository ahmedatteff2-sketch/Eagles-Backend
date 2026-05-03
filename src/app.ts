import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
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
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
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
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

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
app.use("/api", router);

// ─── Serve frontend in production ────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  // dist/index.mjs runs from /project/dist — so public is one level up
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const frontendPath = path.resolve(__dirname, "..", "public");

  if (existsSync(frontendPath)) {
    app.use(express.static(frontendPath, { maxAge: "7d" }));
    // SPA fallback — send index.html for any non-API route
    app.get(/.*/, (_req: Request, res: Response) => {
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
