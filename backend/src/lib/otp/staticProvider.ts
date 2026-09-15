import { OtpProvider } from "./types";
import { logger } from "../logger";

/**
 * Dev/test-only OTP provider — accepts a single fixed code (STATIC_OTP_CODE)
 * for ANY phone number. Sends nothing; there is no SMS involved at all.
 * This is a deliberate bypass, unlike ConsoleOtpProvider, so it is even more
 * tightly guarded: only reachable when STATIC_OTP_CODE is set, and env.ts
 * already refuses to boot with NODE_ENV=production if STATIC_OTP_CODE is set
 * (see env.ts's production guard) — enforced again in ./index.ts's provider
 * selection as a second guard.
 */
export class StaticOtpProvider implements OtpProvider {
  constructor(private readonly code: string) {}

  async sendCode(phone: string): Promise<void> {
    logger.warn(
      { phone },
      "StaticOtpProvider: skipping SMS send (dev/test only) — any phone number accepts the fixed STATIC_OTP_CODE",
    );
  }

  async checkCode(_phone: string, code: string): Promise<boolean> {
    return code === this.code;
  }
}
