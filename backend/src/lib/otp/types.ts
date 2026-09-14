export interface OtpProvider {
  /** Starts (or restarts) a verification for `phone`. Twilio Verify itself owns code generation/expiry/resend limits. */
  sendCode(phone: string): Promise<void>;
  /** Checks `code` against the outstanding verification for `phone`. */
  checkCode(phone: string, code: string): Promise<boolean>;
}
