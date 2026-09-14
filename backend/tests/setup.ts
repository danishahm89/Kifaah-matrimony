import "dotenv/config";

// Point at the dedicated test database (never the dev/prod one) and force
// non-production behavior (ConsoleOtpProvider, permissive CORS, dev JWT
// fallback allowed) — this file is loaded by vitest before any test file's
// own imports, so it runs before src/lib/env.ts is ever evaluated.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kifaah_test?schema=public";
// Never let a real Twilio account accidentally get used in tests.
delete process.env.TWILIO_ACCOUNT_SID;
delete process.env.TWILIO_AUTH_TOKEN;
delete process.env.TWILIO_VERIFY_SERVICE_SID;
process.env.SENTRY_DSN = "";
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || "uploads-test";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "silent";
