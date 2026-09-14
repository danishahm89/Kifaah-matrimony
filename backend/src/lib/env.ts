import "dotenv/config";
import { z } from "zod";

// Centralized, validated environment configuration. Fails fast at boot with a
// clear message rather than starting the server with an insecure default
// (CONTRACT.md §7.3) — this module is imported first thing from src/index.ts
// before anything else touches process.env.

const isProduction = process.env.NODE_ENV === "production";

const baseSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(1).optional(),

  ALLOWED_ORIGINS: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),

  SENTRY_DSN: z.string().optional(),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  UPLOAD_DIR: z.string().default("uploads"),
});

const parsed = baseSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

const DEV_JWT_SECRET = "dev-secret-change-me";

if (isProduction) {
  const missing: string[] = [];
  if (!data.JWT_SECRET || data.JWT_SECRET === DEV_JWT_SECRET) missing.push("JWT_SECRET");
  if (!data.ALLOWED_ORIGINS) missing.push("ALLOWED_ORIGINS");
  const twilioVars = [data.TWILIO_ACCOUNT_SID, data.TWILIO_AUTH_TOKEN, data.TWILIO_VERIFY_SERVICE_SID];
  const twilioComplete = twilioVars.every((v) => !!v);
  if (!twilioComplete) {
    missing.push("TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_VERIFY_SERVICE_SID (all required in production)");
  }
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `Refusing to start with NODE_ENV=production: missing required configuration: ${missing.join(", ")}`
    );
    process.exit(1);
  }
}

export const env = {
  NODE_ENV: data.NODE_ENV,
  isProduction,
  PORT: data.PORT,
  DATABASE_URL: data.DATABASE_URL,

  JWT_SECRET: data.JWT_SECRET || DEV_JWT_SECRET,

  ALLOWED_ORIGINS: (data.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  TWILIO_ACCOUNT_SID: data.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: data.TWILIO_AUTH_TOKEN,
  TWILIO_VERIFY_SERVICE_SID: data.TWILIO_VERIFY_SERVICE_SID,
  twilioConfigured: !!(data.TWILIO_ACCOUNT_SID && data.TWILIO_AUTH_TOKEN && data.TWILIO_VERIFY_SERVICE_SID),

  SENTRY_DSN: data.SENTRY_DSN,

  RAZORPAY_KEY_ID: data.RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET: data.RAZORPAY_KEY_SECRET,
  RAZORPAY_WEBHOOK_SECRET: data.RAZORPAY_WEBHOOK_SECRET,

  UPLOAD_DIR: data.UPLOAD_DIR,
};
