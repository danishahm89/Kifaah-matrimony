import { prisma } from "../lib/prisma";

/**
 * Blocking (CONTRACT §8.3) is symmetric in effect, asymmetric in record: only
 * the blocker's BlockedUser row exists, but both directions must be excluded
 * everywhere a blocked pair could otherwise interact. Every helper here is a
 * query-level check (or produces an id list for a query-level `notIn`/`NOT
 * IN` filter) — never an in-memory filter over an unfiltered result set.
 */

/** True if either user has blocked the other. */
export async function isBlockedPair(userA: string, userB: string): Promise<boolean> {
  const row = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { id: true },
  });
  return !!row;
}

/**
 * Every userId that `userId` is blocked with in either direction — for
 * `id: { notIn: [...] }` exclusion in discover/match-engine candidate
 * queries, so the exclusion happens in the query itself, not by filtering an
 * already-fetched list.
 */
export async function blockedUserIdsFor(userId: string): Promise<string[]> {
  const rows = await prisma.blockedUser.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const r of rows) {
    ids.add(r.blockerId === userId ? r.blockedId : r.blockerId);
  }
  return Array.from(ids);
}

/**
 * A Prisma `OR` fragment excluding any InterestRequest/ChatMessage/etc. row
 * where the *other* party (given by `otherIdField`, e.g. "fromUserId" from
 * the recipient's point of view) is blocked with `userId` in either
 * direction. Used to drop rows at the query level in list endpoints like
 * GET /api/interests/sent|received.
 */
export async function excludeBlockedCondition(userId: string, otherIdField: string) {
  const blocked = await blockedUserIdsFor(userId);
  if (blocked.length === 0) return {};
  return { [otherIdField]: { notIn: blocked } };
}
