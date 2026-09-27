import { prisma } from "./prisma";
import { logger } from "./logger";
import type { ContactKind } from "./contactGuard";

/**
 * Records a blocked attempt so admins can see repeat offenders
 * (GET /api/admin/contact-attempts). The text itself is not stored.
 * Best effort: never fails the request.
 */
export async function recordContactAttempt(
  userId: string,
  where: "chat" | "profile",
  kinds: ContactKind[],
  opts: { toUserId?: string; field?: string } = {}
): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        userId,
        triggeredByUserId: opts.toUserId ?? null,
        type: "contact_share_blocked",
        platform: `${where}${opts.field ? `:${opts.field}` : ""}:${kinds.join(",")}`,
      },
    });
  } catch (err) {
    logger.warn({ err }, "could not record contact attempt");
  }
}
