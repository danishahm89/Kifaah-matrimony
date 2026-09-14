import { OtpProvider } from "./types";
import { TwilioVerifyProvider } from "./twilioProvider";
import { ConsoleOtpProvider } from "./consoleProvider";
import { env } from "../env";
import { logger } from "../logger";

// Selected once at module load (CONTRACT §7.2). env.ts already refuses to
// boot when NODE_ENV=production and Twilio credentials are incomplete, so by
// the time this runs in production the Twilio branch is guaranteed to be
// the one taken — the console provider is unreachable in production.
function selectProvider(): OtpProvider {
  if (env.twilioConfigured) {
    logger.info("OTP provider: Twilio Verify");
    return new TwilioVerifyProvider();
  }
  if (env.isProduction) {
    // Should be unreachable — env.ts already exits before this module loads
    // — but guard here too in case this module is ever imported standalone.
    throw new Error("Refusing to use ConsoleOtpProvider with NODE_ENV=production");
  }
  logger.warn("OTP provider: ConsoleOtpProvider (dev/test only — codes are printed to stdout, no SMS sent)");
  return new ConsoleOtpProvider();
}

export const otpProvider: OtpProvider = selectProvider();
export type { OtpProvider } from "./types";
