import { OtpProvider } from "./types";
import { TwilioVerifyProvider } from "./twilioProvider";
import { ConsoleOtpProvider } from "./consoleProvider";
import { StaticOtpProvider } from "./staticProvider";
import { env } from "../env";
import { logger } from "../logger";

// Selected once at module load (CONTRACT §7.2). env.ts already refuses to
// boot when NODE_ENV=production and STATIC_OTP_CODE is set, or when
// NODE_ENV=production and Twilio credentials are incomplete, so by
// the time this runs in production only the Twilio branch is reachable —
// StaticOtpProvider and ConsoleOtpProvider are guaranteed unreachable.
function selectProvider(): OtpProvider {
  if (env.STATIC_OTP_CODE) {
    if (env.isProduction) {
      // Should be unreachable — env.ts already exits before this module loads
      // — but guard here too in case this module is ever imported standalone.
      throw new Error("Refusing to use StaticOtpProvider with NODE_ENV=production");
    }
    logger.warn(
      "OTP provider: StaticOtpProvider (dev/test only — ANY phone number is accepted with the fixed code, no SMS sent)",
    );
    return new StaticOtpProvider(env.STATIC_OTP_CODE);
  }
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
