import crypto from "crypto";
import { OtpProvider } from "./types";
import { logger } from "../logger";
import { appConfig } from "../appConfig";

const CODE_TTL_MS = appConfig.otp.consoleProviderTtlMinutes * 60 * 1000;

interface PendingCode {
  code: string;
  expiresAt: number;
}

/**
 * Dev/test-only OTP provider — logs the code to the server console instead of
 * sending a real SMS. Never a bypass: the caller must still present the
 * exact code that was printed. CONTRACT §7.2 requires this to be unreachable
 * whenever NODE_ENV=production; enforced in ./index.ts's provider selection,
 * not here.
 */
export class ConsoleOtpProvider implements OtpProvider {
  private pending = new Map<string, PendingCode>();

  async sendCode(phone: string): Promise<void> {
    const code = crypto.randomInt(100000, 999999).toString();
    this.pending.set(phone, { code, expiresAt: Date.now() + CODE_TTL_MS });
    // Intentionally a plain console.log (not the pino logger) so the code is
    // impossible to miss and never gets swept up by structured-log redaction
    // tooling that might otherwise be pointed at a real log sink.
    // eslint-disable-next-line no-console
    console.log(`\n[ConsoleOtpProvider] OTP for ${phone}: ${code} (dev/test only, expires in 10m)\n`);
    logger.info({ phone }, "ConsoleOtpProvider issued a dev OTP (see stdout)");
  }

  async checkCode(phone: string, code: string): Promise<boolean> {
    const entry = this.pending.get(phone);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.pending.delete(phone);
      return false;
    }
    const ok = entry.code === code;
    if (ok) this.pending.delete(phone); // one-time use
    return ok;
  }
}
