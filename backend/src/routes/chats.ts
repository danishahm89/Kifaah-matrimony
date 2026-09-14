import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { canChat } from "../services/visibility";
import { emitChatMessage } from "../services/socket";
import { sendPushToUser } from "../lib/push";

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;

  const accepted = await prisma.interestRequest.findMany({
    where: {
      status: "accepted",
      OR: [{ fromUserId: userId }, { toUserId: userId }],
    },
  });

  const otherIds = accepted.map((ir) => (ir.fromUserId === userId ? ir.toUserId : ir.fromUserId));

  const conversations = [];
  for (const otherId of otherIds) {
    const eligible = await canChat(userId, otherId);
    if (!eligible) continue;

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

  const eligible = await canChat(userId, otherId);
  if (!eligible) {
    return res.status(403).json({ error: "chat_not_available" });
  }

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
  });
});

const sendMessageSchema = z.object({ text: z.string().min(1).max(4000) });

router.post("/:userId/messages", requireAuth, async (req: AuthedRequest, res) => {
  const fromUserId = req.userId!;
  const toUserId = req.params.userId;

  const eligible = await canChat(fromUserId, toUserId);
  if (!eligible) {
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

  const fromProfile = await prisma.profile.findUnique({ where: { userId: fromUserId } });
  sendPushToUser(toUserId, fromProfile?.name || "New message", message.text.slice(0, 120), {
    type: "chat_message",
    fromUserId,
  }).catch(() => {});

  res.status(201).json(message);
});

export default router;
