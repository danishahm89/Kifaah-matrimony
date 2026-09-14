import { prisma } from "../lib/prisma";

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
  if (!row) return "none";
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

/**
 * Chat eligibility per CONTRACT §2/§4: reachable only once the interest
 * between the two users is accepted AND *both* sides currently have an
 * active subscription — stricter than the prototype, which only checked one
 * side.
 */
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

  const [userSubscribed, otherSubscribed] = await Promise.all([
    isSubscriptionActive(userId),
    isSubscriptionActive(otherId),
  ]);
  return userSubscribed && otherSubscribed;
}
