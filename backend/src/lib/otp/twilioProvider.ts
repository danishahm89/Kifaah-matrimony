import twilio from "twilio";
import { OtpProvider } from "./types";
import { env } from "../env";
import { logger } from "../logger";

/** Real SMS OTP via Twilio Verify (CONTRACT §7.2). Twilio owns code generation, expiry and per-phone attempt/resend limiting. */
export class TwilioVerifyProvider implements OtpProvider {
  private client: ReturnType<typeof twilio>;
  private serviceSid: string;

  constructor() {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_VERIFY_SERVICE_SID) {
      throw new Error("TwilioVerifyProvider requires TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_VERIFY_SERVICE_SID");
    }
    this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    this.serviceSid = env.TWILIO_VERIFY_SERVICE_SID;
  }

  async sendCode(phone: string): Promise<void> {
    await this.client.verify.v2.services(this.serviceSid).verifications.create({ to: phone, channel: "sms" });
  }

  async checkCode(phone: string, code: string): Promise<boolean> {
    try {
      const check = await this.client.verify.v2.services(this.serviceSid).verificationChecks.create({ to: phone, code });
      return check.status === "approved";
    } catch (err) {
      // Twilio throws (e.g. 404) when there's no pending verification for this phone/code combo.
      logger.debug({ err }, "twilio verification check failed");
      return false;
    }
  }
}
