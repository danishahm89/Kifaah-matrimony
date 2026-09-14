import pino from "pino";
import { env } from "./env";
import { appConfig } from "./appConfig";

// Structured logging (CONTRACT §7.3) — replaces console.log/console.error.
// Redact common secret-bearing paths so tokens/OTP codes/Razorpay keys never
// land in logs even if a caller accidentally logs a whole object. The level
// itself comes from config/*.yaml (appConfig.logging.level); LOG_LEVEL can
// still override it at runtime without a redeploy (e.g. tests/setup.ts sets
// it to "silent" to keep test output clean).
export const logger = pino({
  level: process.env.LOG_LEVEL || appConfig.logging.level,
  redact: {
    paths: [
      "req.headers.authorization",
      "*.token",
      "*.refreshToken",
      "*.accessToken",
      "*.password",
      "*.code",
      "*.otp",
      "*.signature",
      "razorpayKeySecret",
      "RAZORPAY_KEY_SECRET",
      "JWT_SECRET",
      "TWILIO_AUTH_TOKEN",
    ],
    censor: "[redacted]",
  },
  transport:
    env.isProduction
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
        },
});
