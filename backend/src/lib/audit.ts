import { prisma } from "./prisma";
import { logger } from "./logger";

export type AuditEvent =
  | "otp_verified"
  | "login"
  | "logout"
  | "logout_all"
  | "subscription_activated"
  | "contact_unlocked"
  | "refresh_token_reused_detected";

interface WriteAuditLogInput {
  userId?: string | null;
  event: AuditEvent;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

/** Best-effort AuditLog write (CONTRACT §7.1/§7.3) — never throws into the caller's request path. */
export async function writeAuditLog({ userId, event, metadata, ip }: WriteAuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        event,
        metadata: metadata ? (metadata as any) : undefined,
        ip: ip ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, event }, "failed to write audit log");
  }
}
