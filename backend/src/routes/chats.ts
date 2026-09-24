import crypto from "crypto";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { isSubscriptionActive } from "../services/visibility";
import { isBlockedPair } from "../services/blocks";
import {
  findConversationForUsers,
  closeConversation,
  requestReopen,
  acceptReopen,
  rejectReopen,
  conversationStatusLabel,
} from "../services/conversations";
import { emitChatMessage } from "../services/socket";
import { createNotification } from "../lib/notifications";

const router = Router();

/**
 * Resolves whether `userId` can currently exchange messages with `otherId`,
 * and why not when they can't (CONTRACT §8.8's `conversationStatus`/
 * `canMessage`/reason fields, and the 403 gate on the messages routes).
 */
async function resolveChatEligibility(userId: string, otherId: string) {
  const conversation = await findConversationForUsers(userId, otherId);
  if (!conversation) {
    return { conversation: null, canMessage: false, reason: "no_accepted_interest" as const };
  }
  if (conversation.status !== "ACTIVE") {
    return { conversation, canMessage: false, reason: conversationStatusLabel(conversation.status) };
  }
  const [userSubscribed, otherSubscribed] = await Promise.all([
    isSubscriptionActive(userId),
    isSubscriptionActive(otherId),
  ]);
  if (!userSubscribed || !otherSubscribed) {
    return { conversation, canMessage: false, reason: "not_subscribed" as const };
  }
  return { conversation, canMessage: true, reason: null };
}

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const archived = req.query.archived === "true";

  const accepted = await prisma.interestRequest.findMany({
    where: {
      status: "accepted",
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
  });

  const conversations = [];
  for (const interest of accepted) {
    const otherId = interest.fromUserId === userId ? interest.toUserId : interest.fromUserId;

    const eligibility = await resolveChatEligibility(userId, otherId);
    if (!eligibility.conversation) continue; // shouldn't happen (interest is accepted), but keep it safe

    const isArchived = !!eligibility.conversation.archivedAt;
    if (archived !== isArchived) continue;

    const other = await prisma.user.findUnique({ where: { id: otherId }, include: { profile: true } });
    if (!other) continue;

    const lastMessage = await prisma.chatMessage.findFirst({
      where: {
        OR: [
          { fromUserId: userId, toUserId: otherId },
          { fromUserId: otherId, toUserId: userId },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    conversations.push({
      userId: other.id,
      name: other.profile?.name || "Member",
      photoUrl: other.profile?.photoUrl ?? null,
      lastMessage: lastMessage?.text ?? null,
      lastMessageAt: lastMessage?.createdAt ?? null,
      conversationId: eligibility.conversation.id,
      conversationStatus: conversationStatusLabel(eligibility.conversation.status),
      canMessage: eligibility.canMessage,
      canMessageReason: eligibility.canMessage ? null : eligibility.reason,
      archivedAt: eligibility.conversation.archivedAt,
    });
  }

  conversations.sort((a, b) => {
    const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bt - at;
  });

  res.json(conversations);
});

router.get("/:userId/messages", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const otherId = req.params.userId;

  if (await isBlockedPair(userId, otherId)) {
    return res.status(403).json({ error: "blocked" });
  }

  const eligibility = await resolveChatEligibility(userId, otherId);
  if (!eligibility.conversation) {
    return res.status(403).json({ error: "chat_not_available" });
  }
  // Reading history is allowed for CLOSED/REOPEN_REQUESTED/archived
  // conversations (messages are never deleted, CONTRACT §8.2) — only
  // *sending* is gated on ACTIVE. BLOCKED is the one status that also blocks
  // reading, enforced by the isBlockedPair check above.

  const messages = await prisma.chatMessage.findMany({
    where: {
      OR: [
        { fromUserId: userId, toUserId: otherId },
        { fromUserId: otherId, toUserId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  const viewer = await prisma.user.findUnique({ where: { id: userId } });

  res.json({
    messages,
    chaperoneChat: viewer?.chaperoneChat ?? true,
    conversationStatus: conversationStatusLabel(eligibility.conversation.status),
    canMessage: eligibility.canMessage,
  });
});

const sendMessageSchema = z.object({ text: z.string().min(1).max(4000) });

router.post("/:userId/messages", requireAuth, async (req: AuthedRequest, res) => {
  const fromUserId = req.userId!;
  const toUserId = req.params.userId;

  if (await isBlockedPair(fromUserId, toUserId)) {
    return res.status(403).json({ error: "blocked" });
  }

  const eligibility = await resolveChatEligibility(fromUserId, toUserId);
  if (!eligibility.conversation) {
    return res.status(403).json({ error: "chat_not_available" });
  }
  if (eligibility.conversation.status !== "ACTIVE") {
    return res.status(403).json({ error: "conversation_not_active" });
  }
  if (!eligibility.canMessage) {
    return res.status(403).json({ error: "chat_not_available" });
  }

  const parsed = sendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }

  const message = await prisma.chatMessage.create({
    data: { fromUserId, toUserId, text: parsed.data.text },
  });

  emitChatMessage(toUserId, message);
  emitChatMessage(fromUserId, message);

  await createNotification({
    userId: toUserId,
    type: "new_message",
    title: "New message",
    message: message.text.slice(0, 120),
    referenceId: fromUserId,
    fromUserId,
    push: true,
  });

  res.status(201).json(message);
});

// --- Close / reopen (CONTRACT §8.2/§8.8) ---------------------------------

router.post("/:userId/close", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const otherId = req.params.userId;

  const conversation = await findConversationForUsers(userId, otherId);
  if (!conversation) return res.status(404).json({ error: "not_found" });

  const result = await closeConversation(conversation.id, userId);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  await createNotification({
    userId: otherId,
    type: "conversation_closed",
    title: "Conversation closed",
    message: "The other participant closed your conversation.",
    referenceId: userId,
    fromUserId: userId,
    push: false, // in-app only, per CONTRACT §8.6
  });

  res.json({ conversationStatus: conversationStatusLabel(result.conversation.status) });
});

router.post("/:userId/reopen-request", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const otherId = req.params.userId;

  const conversation = await findConversationForUsers(userId, otherId);
  if (!conversation) return res.status(404).json({ error: "not_found" });

  const result = await requestReopen(conversation.id, userId);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  const requesterProfile = await prisma.profile.findUnique({ where: { userId } });
  await createNotification({
    userId: otherId,
    type: "reopen_requested",
    title: "Reopen request",
    message: `${requesterProfile?.name || "Someone"} has requested to reopen your previous conversation.`,
    referenceId: userId,
    fromUserId: userId,
    push: true,
  });

  res.json({ conversationStatus: conversationStatusLabel(result.conversation.status) });
});

router.post("/:userId/reopen-request/accept", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const otherId = req.params.userId;

  const conversation = await findConversationForUsers(userId, otherId);
  if (!conversation) return res.status(404).json({ error: "not_found" });

  const result = await acceptReopen(conversation.id, userId);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  const accepterProfile = await prisma.profile.findUnique({ where: { userId } });
  await createNotification({
    userId: otherId,
    type: "reopen_accepted",
    title: "Reopen accepted",
    message: `${accepterProfile?.name || "Someone"} accepted your reopen request.`,
    referenceId: userId,
    fromUserId: userId,
    push: true,
  });

  res.json({ conversationStatus: conversationStatusLabel(result.conversation.status) });
});

router.post("/:userId/reopen-request/reject", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const otherId = req.params.userId;

  const conversation = await findConversationForUsers(userId, otherId);
  if (!conversation) return res.status(404).json({ error: "not_found" });

  const result = await rejectReopen(conversation.id, userId);
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  const rejecterProfile = await prisma.profile.findUnique({ where: { userId } });
  await createNotification({
    userId: otherId,
    type: "reopen_rejected",
    title: "Reopen declined",
    message: `${rejecterProfile?.name || "Someone"} declined your reopen request.`,
    referenceId: userId,
    fromUserId: userId,
    push: true,
  });

  res.json({ conversationStatus: conversationStatusLabel(result.conversation.status) });
});

// --- Wali sharing (CONTRACT §8.5) ----------------------------------------

router.post("/:userId/wali-share", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const otherId = req.params.userId;

  const conversation = await findConversationForUsers(userId, otherId);
  if (!conversation) return res.status(404).json({ error: "not_found" });

  const viewer = await prisma.user.findUnique({ where: { id: userId } });
  if (!viewer || viewer.gender !== "BRIDE") {
    return res.status(403).json({ error: "bride_only" });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const share = await prisma.waliShare.create({
    data: { conversationId: conversation.id, sharedByUserId: userId, accessToken: token },
  });

  // PUBLIC_APP_URL overrides for deployments behind something that mangles
  // the host header despite `trust proxy` (src/app.ts); otherwise derive it
  // from the actual request so this never points at a placeholder domain
  // that doesn't exist. Points at this same API's own GET /api/wali/:token
  // (below) — there is no separate web frontend — which content-negotiates
  // a minimal read-only HTML page for a browser vs JSON for API callers.
  const baseUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get("host")}`;
  res.status(201).json({ token: share.accessToken, url: `${baseUrl}/api/wali/${share.accessToken}` });
});

router.delete("/:userId/wali-share", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const otherId = req.params.userId;

  const conversation = await findConversationForUsers(userId, otherId);
  if (!conversation) return res.status(404).json({ error: "not_found" });

  await prisma.waliShare.updateMany({
    where: { conversationId: conversation.id, sharedByUserId: userId, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  });

  res.json({ ok: true }); // idempotent
});

router.get("/:userId/wali-share", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const otherId = req.params.userId;

  const conversation = await findConversationForUsers(userId, otherId);
  if (!conversation) return res.status(404).json({ error: "not_found" });

  const share = await prisma.waliShare.findFirst({
    where: { conversationId: conversation.id, sharedByUserId: userId },
    orderBy: { createdAt: "desc" },
  });

  if (!share) return res.json({ status: "none", createdAt: null });
  res.json({ status: share.revoked ? "revoked" : "active", createdAt: share.createdAt });
});

export default router;
