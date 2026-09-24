import { Conversation, ConversationStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Every transition's `tx.conversation.update` filters on `{ id, status:
 * <the status it just read> }` (Prisma's "filtered update" — an extra,
 * non-unique field alongside the unique `id`). Under concurrent requests,
 * Postgres row-locking means the loser's UPDATE blocks until the winner
 * commits, then re-evaluates that WHERE clause against the now-changed row
 * and matches zero rows — Prisma surfaces that as a P2025 "record not
 * found" error. This helper turns that specific race outcome into `null`
 * (the 409 case) instead of letting it throw out of `prisma.$transaction`.
 */
async function updateIfStillInStatus<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
}

/**
 * Conversation state machine — CONTRACT §8.2. Allowed transitions only:
 *
 *   (created on interest accept) -> ACTIVE
 *   ACTIVE           -> CLOSED             (either participant closes it)
 *   ACTIVE           -> BLOCKED            (either participant blocks the other)
 *   CLOSED           -> REOPEN_REQUESTED   (either participant requests reopen)
 *   REOPEN_REQUESTED -> ACTIVE             (the OTHER participant accepts)
 *   REOPEN_REQUESTED -> CLOSED             (the other participant rejects, or the requester cancels)
 *   BLOCKED          -> REOPEN_REQUESTED   (once unblocked — same reopen flow as CLOSED)
 *
 * Every transition here re-reads the row *inside* a prisma.$transaction and
 * checks its current status before writing, so two concurrent requests
 * against the same conversation can't corrupt state — the loser of the race
 * gets a clean `{ ok: false, status: 409 }`, never a silent double-apply.
 */

export type TransitionResult =
  | { ok: true; conversation: Conversation }
  | { ok: false; status: 403 | 404 | 409; error: string };

/** Finds (or lazily creates) the Conversation for an accepted InterestRequest. Retrofits Conversation rows for interests accepted before this feature existed. */
export async function getOrCreateConversation(interestId: string): Promise<Conversation> {
  const existing = await prisma.conversation.findUnique({ where: { interestId } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { interestId, status: "ACTIVE" } });
}

/** Finds the Conversation between two users via their (any-direction) accepted InterestRequest, lazily creating the row if missing. Null if no accepted interest exists between them. */
export async function findConversationForUsers(userId: string, otherId: string): Promise<Conversation | null> {
  const interest = await prisma.interestRequest.findFirst({
    where: {
      status: "accepted",
      OR: [
        { fromUserId: userId, toUserId: otherId },
        { fromUserId: otherId, toUserId: userId },
      ],
    },
  });
  if (!interest) return null;
  return getOrCreateConversation(interest.id);
}

/** The other participant's userId for a Conversation, given one participant. */
export async function otherParticipantId(conversation: Conversation, userId: string): Promise<string | null> {
  const interest = await prisma.interestRequest.findUnique({ where: { id: conversation.interestId } });
  if (!interest) return null;
  if (interest.fromUserId === userId) return interest.toUserId;
  if (interest.toUserId === userId) return interest.fromUserId;
  return null;
}

/** Both participant userIds for a Conversation. */
export async function participantIds(conversation: Conversation): Promise<{ fromUserId: string; toUserId: string } | null> {
  const interest = await prisma.interestRequest.findUnique({ where: { id: conversation.interestId } });
  if (!interest) return null;
  return { fromUserId: interest.fromUserId, toUserId: interest.toUserId };
}

/**
 * On close (any -> CLOSED): reset the photo-consent cycle (delete
 * PhotoAccessRequest rows for the conversation so a fresh request after
 * reopen starts from "none") and revoke any active WaliShare. Never touches
 * ChatMessage — history is preserved.
 */
async function resetApprovalCycle(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], conversationId: string) {
  await tx.photoAccessRequest.deleteMany({ where: { conversationId } });
  await tx.waliShare.updateMany({
    where: { conversationId, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });
}

export async function closeConversation(conversationId: string, byUserId: string): Promise<TransitionResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!current) return { ok: false, status: 404, error: "not_found" };
    if (current.status !== "ACTIVE" && current.status !== "BLOCKED") {
      return { ok: false, status: 409, error: "invalid_transition" };
    }
    const conversation = await updateIfStillInStatus(() =>
      tx.conversation.update({
        where: { id: conversationId, status: current.status },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedByUserId: byUserId,
          reopenRequestedByUserId: null,
          reopenRequestedAt: null,
        },
      })
    );
    if (!conversation) return { ok: false, status: 409, error: "invalid_transition" };
    await resetApprovalCycle(tx, conversationId);
    return { ok: true, conversation };
  });
}

export async function requestReopen(conversationId: string, byUserId: string): Promise<TransitionResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!current) return { ok: false, status: 404, error: "not_found" };
    if (current.status !== "CLOSED" && current.status !== "BLOCKED") {
      return { ok: false, status: 409, error: "invalid_transition" };
    }
    const conversation = await updateIfStillInStatus(() =>
      tx.conversation.update({
        where: { id: conversationId, status: current.status },
        data: {
          status: "REOPEN_REQUESTED",
          reopenRequestedByUserId: byUserId,
          reopenRequestedAt: new Date(),
        },
      })
    );
    if (!conversation) return { ok: false, status: 409, error: "invalid_transition" };
    return { ok: true, conversation };
  });
}

export async function acceptReopen(conversationId: string, byUserId: string): Promise<TransitionResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!current) return { ok: false, status: 404, error: "not_found" };
    if (current.status !== "REOPEN_REQUESTED") {
      return { ok: false, status: 409, error: "invalid_transition" };
    }
    if (current.reopenRequestedByUserId === byUserId) {
      // Accepting your own reopen request is never allowed (CONTRACT §8.8/§8.12) —
      // must be the OTHER participant.
      return { ok: false, status: 403, error: "forbidden" };
    }
    const conversation = await updateIfStillInStatus(() =>
      tx.conversation.update({
        where: { id: conversationId, status: "REOPEN_REQUESTED" },
        data: {
          status: "ACTIVE",
          closedAt: null,
          closedByUserId: null,
          reopenRequestedByUserId: null,
          reopenRequestedAt: null,
        },
      })
    );
    if (!conversation) return { ok: false, status: 409, error: "invalid_transition" };
    return { ok: true, conversation };
  });
}

/**
 * Rejecting a reopen request -> CLOSED. Per §8.2 this transition is reachable
 * both when the other participant rejects, and when the requester themself
 * cancels their own pending request — so unlike `acceptReopen`, this is not
 * restricted to the other participant. Callers still confirm `byUserId` is
 * one of the two conversation participants before calling this.
 */
export async function rejectReopen(conversationId: string, byUserId: string): Promise<TransitionResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.conversation.findUnique({ where: { id: conversationId } });
    if (!current) return { ok: false, status: 404, error: "not_found" };
    if (current.status !== "REOPEN_REQUESTED") {
      return { ok: false, status: 409, error: "invalid_transition" };
    }
    const conversation = await updateIfStillInStatus(() =>
      tx.conversation.update({
        where: { id: conversationId, status: "REOPEN_REQUESTED" },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedByUserId: byUserId,
          reopenRequestedByUserId: null,
          reopenRequestedAt: null,
        },
      })
    );
    if (!conversation) return { ok: false, status: 409, error: "invalid_transition" };
    await resetApprovalCycle(tx, conversationId);
    return { ok: true, conversation };
  });
}

/**
 * Blocking transitions an ACTIVE conversation to BLOCKED (§8.2/§8.3), as part
 * of the same transaction as the BlockedUser row (the caller passes `tx`).
 * Conversations already CLOSED/REOPEN_REQUESTED/BLOCKED are left as-is —
 * BLOCKED is only a listed transition target from ACTIVE.
 */
export async function blockActiveConversation(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  conversationId: string
): Promise<void> {
  const current = await tx.conversation.findUnique({ where: { id: conversationId } });
  if (!current || current.status !== "ACTIVE") return;
  const updated = await updateIfStillInStatus(() =>
    tx.conversation.update({
      where: { id: conversationId, status: "ACTIVE" },
      data: { status: "BLOCKED" },
    })
  );
  if (!updated) return;
  await resetApprovalCycle(tx, conversationId);
}

/**
 * Six-month archive sweep (CONTRACT §8.9) — a plain indexed UPDATE using the
 * @@index([status, closedAt]) from §8.1, not a full table scan. Returns the
 * number of rows archived. Safe to call directly (used by the cron job in
 * src/index.ts and exercised directly in tests) or repeatedly (archivedAt IS
 * NULL makes it idempotent).
 */
export async function archiveOldClosedConversations(): Promise<number> {
  const result = await prisma.$executeRaw`
    UPDATE "Conversation"
    SET "archivedAt" = now()
    WHERE status = 'CLOSED'
      AND "closedAt" < now() - interval '6 months'
      AND "archivedAt" IS NULL
  `;
  return result;
}

export function conversationStatusLabel(status: ConversationStatus): "active" | "closed" | "reopen_requested" | "blocked" {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "CLOSED":
      return "closed";
    case "REOPEN_REQUESTED":
      return "reopen_requested";
    case "BLOCKED":
      return "blocked";
  }
}
