import * as Sentry from "@sentry/node";
import { env } from "./env";

// Conditional on SENTRY_DSN (CONTRACT §7.3) — a no-op when it isn't set.
// Never fabricate a DSN.
export const sentryEnabled = !!env.SENTRY_DSN;

export function initSentry() {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export function captureException(err: unknown) {
  if (!sentryEnabled) return;
  Sentry.captureException(err);
}

export { Sentry };
