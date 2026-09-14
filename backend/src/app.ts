// env must be the very first internal import anywhere it's transitively
// pulled in — it validates process.env and exits immediately on a
// misconfigured production boot, before anything else runs with insecure
// defaults. index.ts and the test setup both import this module first.
import { env } from "./lib/env";
import { initSentry, captureException } from "./lib/sentry";
initSentry();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import pinoHttp from "pino-http";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { generalLimiter } from "./middleware/rateLimit";

import authRoutes from "./routes/auth";
import referenceRoutes from "./routes/reference";
import profileRoutes from "./routes/profile";
import accountRoutes from "./routes/account";
import discoverRoutes from "./routes/discover";
import interestsRoutes from "./routes/interests";
import chatsRoutes from "./routes/chats";
import notificationsRoutes from "./routes/notifications";
import matchEngineRoutes from "./routes/matchEngine";
import pricingRoutes from "./routes/pricing";
import paymentsRoutes from "./routes/payments";
import faqRoutes from "./routes/faq";

export const app = express();

app.disable("x-powered-by"); // also handled by helmet, but explicit per CONTRACT §7.3
app.use(helmet());

app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === "/health" || req.url === "/ready" },
  })
);

// CORS: locked to ALLOWED_ORIGINS in production, permissive only outside it
// (CONTRACT §7.3). env.ts already refuses to boot in production without
// ALLOWED_ORIGINS set, so this is deny-by-default there.
const allowedOrigins = env.ALLOWED_ORIGINS;
app.use(
  cors(
    env.isProduction
      ? {
          origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error("not allowed by CORS"));
          },
        }
      : {}
  )
);

app.set("trust proxy", 1);

// Razorpay webhook needs the exact raw request body to verify its HMAC
// signature, so that one path is parsed with express.raw() instead of
// express.json() — everything else gets normal JSON parsing.
const rawBodyParser = express.raw({ type: "application/json" });
const jsonBodyParser = express.json();
app.use((req, res, next) => {
  if (req.path === "/api/payments/webhook") {
    return rawBodyParser(req, res, next);
  }
  return jsonBodyParser(req, res, next);
});

const UPLOAD_DIR = env.UPLOAD_DIR;
app.use("/uploads", express.static(path.resolve(UPLOAD_DIR)));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "readiness check failed");
    res.status(503).json({ ok: false, error: "db_unreachable" });
  }
});

app.use("/api", generalLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/reference", referenceRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/account", accountRoutes);
app.use("/api", discoverRoutes); // GET /api/discover, GET /api/profiles/:id
app.use("/api/interests", interestsRoutes);
app.use("/api/chats", chatsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/match-engine", matchEngineRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/faq", faqRoutes);

// Not-found + error handlers
app.use((_req, res) => res.status(404).json({ error: "not_found" }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "unhandled request error");
  captureException(err);
  res.status(500).json({ error: "internal_error" });
});

export default app;
