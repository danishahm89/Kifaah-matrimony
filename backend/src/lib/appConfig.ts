import fs from "fs";
import path from "path";
// Namespace import, not a default import: js-yaml has no default export, and
// a default import resolves inconsistently between plain tsc/node (CJS
// interop) and vitest's ESM-aware transform (observed failing under the
// latter with `yaml` itself coming back undefined) — `import *` is safe
// under both.
import * as yaml from "js-yaml";
import { z } from "zod";
import { env } from "./env";

// Non-secret, per-environment behavioral tuning lives in config/*.yaml,
// checked into git and reviewed like code — distinct from env.ts, which
// holds secrets and per-deployment-instance values (DB URL, JWT secret,
// Twilio/Razorpay/Sentry credentials, allowed CORS origins, port, upload
// dir). See config/default.yaml for the full rationale.

const configSchema = z.object({
  rateLimit: z.object({
    general: z.object({ windowMs: z.number().int().positive(), limit: z.number().int().positive() }),
    otpSend: z.object({ windowMs: z.number().int().positive(), limit: z.number().int().positive() }),
    otpVerify: z.object({ windowMs: z.number().int().positive(), limit: z.number().int().positive() }),
    refresh: z.object({ windowMs: z.number().int().positive(), limit: z.number().int().positive() }),
  }),
  auth: z.object({
    jwtExpiresIn: z.string().min(1),
    refreshTokenDays: z.number().int().positive(),
  }),
  matchEngine: z.object({
    cron: z.string().min(1),
    minScore: z.number().int().min(0).max(100),
  }),
  upload: z.object({
    maxFileSizeMb: z.number().positive(),
    maxDimensionPx: z.number().int().positive(),
  }),
  logging: z.object({
    level: z.string().min(1),
  }),
  otp: z.object({
    consoleProviderTtlMinutes: z.number().positive(),
  }),
});

export type AppConfig = z.infer<typeof configSchema>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    result[key] = isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return result;
}

// Resolved relative to the current working directory rather than
// __dirname: __dirname would point at src/lib in dev but dist/src/lib in
// the compiled build, an asymmetry that bit this project once already
// (see the Dockerfile CMD path fix). The server is always started with
// backend/ as the working directory — locally, in CI, and in the
// container (Dockerfile's WORKDIR /app) — so process.cwd() is stable.
const CONFIG_DIR = path.join(process.cwd(), "config");

function loadYaml(file: string): Record<string, unknown> {
  const filePath = path.join(CONFIG_DIR, file);
  if (!fs.existsSync(filePath)) return {};
  const parsed = yaml.load(fs.readFileSync(filePath, "utf8"));
  return isPlainObject(parsed) ? parsed : {};
}

// NODE_ENV=test (set by tests/setup.ts) intentionally shares development.yaml
// rather than getting its own file — see config/default.yaml.
const overlayFile = env.isProduction ? "production.yaml" : "development.yaml";
const merged = deepMerge(loadYaml("default.yaml"), loadYaml(overlayFile));

const result = configSchema.safeParse(merged);
if (!result.success) {
  // eslint-disable-next-line no-console
  console.error(
    `Invalid config/default.yaml + config/${overlayFile} configuration:`,
    result.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const appConfig: AppConfig = result.data;
