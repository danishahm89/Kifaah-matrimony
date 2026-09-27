import { prisma } from "../lib/prisma";
import { appConfig } from "../lib/appConfig";

export type InterestStatus = "none" | "sent" | "received" | "accepted" | "declined";

export async function isSubscriptionActive(userId: string): Promise<boolean> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  return sub?.status === "active";
}

/**
 * Interest status of `viewerId` relative to `candidateId`, from the viewer's
 * point of view: "sent" = viewer sent it, "received" = candidate sent it to
 * viewer, "accepted"/"declined" regardless of who sent it, "none" otherwise.
 */
export async function getInterestStatus(viewerId: string, candidateId: string): Promise<InterestStatus> {
  const row = await prisma.interestRequest.findFirst({
    where: {
      OR: [
        { fromUserId: viewerId, toUserId: candidateId },
        { fromUserId: candidateId, toUserId: viewerId },
      ],
    },
  });
  // An expired request can simply be sent again, so treat it like none.
  if (!row || row.status === "expired") return "none";
  if (row.status === "accepted") return "accepted";
  if (row.status === "declined") return "declined";
  return row.fromUserId === viewerId ? "sent" : "received";
}

/** Photo/contact unlock rule per CONTRACT §2: viewer subscribed AND interest mutually accepted. */
export function isUnlocked(viewerSubscribed: boolean, interestStatus: InterestStatus): boolean {
  return viewerSubscribed && interestStatus === "accepted";
}

export const LOCK_MESSAGE =
  "Photo and contact details unlock once you have an active subscription and this interest is mutually accepted.";

export type ChatPaymentAccess =
  | { allowed: true; freeMessagesLeft: number | null }
  | { allowed: false; reason: "free_limit_reached"; freeMessagesLeft: 0 };

/**
 * Payment side of chat, after the interest is accepted (India audit, R3):
 * - if EITHER person has an active plan, both can chat freely;
 * - if neither has one, each can still send `chat.freeMessagesPerPerson`
 *   messages, so a matched pair can say salaam and involve families.
 * `freeMessagesLeft` is null when unlimited.
 */
export async function chatPaymentAccess(userId: string, otherId: string): Promise<ChatPaymentAccess> {
  const [userSubscribed, otherSubscribed] = await Promise.all([
    isSubscriptionActive(userId),
    isSubscriptionActive(otherId),
  ]);
  if (userSubscribed || otherSubscribed) return { allowed: true, freeMessagesLeft: null };
  const limit = appConfig.chat.freeMessagesPerPerson;
  const sent = await prisma.chatMessage.count({ where: { fromUserId: userId, toUserId: otherId } });
  const left = Math.max(0, limit - sent);
  return left > 0
    ? { allowed: true, freeMessagesLeft: left }
    : { allowed: false, reason: "free_limit_reached", freeMessagesLeft: 0 };
}

/** Accepted interest + chatPaymentAccess (see above). */
export async function canChat(userId: string, otherId: string): Promise<boolean> {
  const interest = await prisma.interestRequest.findFirst({
    where: {
      status: "accepted",
      OR: [
        { fromUserId: userId, toUserId: otherId },
        { fromUserId: otherId, toUserId: userId },
      ],
    },
  });
  if (!interest) return false;
  return (await chatPaymentAccess(userId, otherId)).allowed;
}
