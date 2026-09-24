import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { isSubscriptionActive } from "../services/visibility";
import { isBlockedPair, blockedUserIdsFor } from "../services/blocks";
import { getOrCreateConversation } from "../services/conversations";
import { createNotification } from "../lib/notifications";

const router = Router();

router.post("/:profileId", requireAuth, async (req: AuthedRequest, res) => {
  const fromUserId = req.userId!;
  const toUserId = req.params.profileId;

  if (fromUserId === toUserId) {
    return res.status(400).json({ error: "cannot_send_to_self" });
  }

  const target = await prisma.user.findUnique({ where: { id: toUserId } });
  if (!target) {
    return res.status(404).json({ error: "not_found" });
  }

  // CONTRACT §8.3 — blocked in either direction.
  if (await isBlockedPair(fromUserId, toUserId)) {
    return res.status(403).json({ error: "blocked" });
  }

  const subscribed = await isSubscriptionActive(fromUserId);
  if (!subscribed) {
    return res.status(402).json({ error: "subscription_required" });
  }

  const existing = await prisma.interestRequest.findFirst({
    where: {
      OR: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
    },
  });
  if (existing) {
    return res.status(409).json({ error: "already_exists" });
  }

  const interest = await prisma.interestRequest.create({
    data: { fromUserId, toUserId },
  });

  await createNotification({
    userId: toUserId,
    type: "new_request",
    title: "New connection request",
    message: "You have received a new connection request.",
    referenceId: fromUserId,
    fromUserId,
    push: true,
  });

  res.status(201).json(interest);
});

router.get("/sent", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const blocked = await blockedUserIdsFor(userId);

  const rows = await prisma.interestRequest.findMany({
    where: {
      fromUserId: userId,
      ...(blocked.length > 0 ? { toUserId: { notIn: blocked } } : {}),
    },
    include: { toUser: { include: { profile: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      profile: {
        id: r.toUser.id,
        name: r.toUser.profile?.name || "Member",
        age: r.toUser.profile?.age ?? null,
        city: r.toUser.profile?.city ?? null,
        sect: r.toUser.profile?.sect ?? null,
      },
    }))
  );
});

// CONTRACT §8.8 requirement-2 fix: only "pending" requests belong here now —
// accepted ones surface via the extended GET /api/chats instead, so the
// mobile Matches screen no longer shows Accept/Decline on an already-decided
// request.
router.get("/received", requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const blocked = await blockedUserIdsFor(userId);

  const rows = await prisma.interestRequest.findMany({
    where: {
      toUserId: userId,
      status: "pending",
      ...(blocked.length > 0 ? { fromUserId: { notIn: blocked } } : {}),
    },
    include: { fromUser: { include: { profile: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    rows.map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.createdAt,
      profile: {
        id: r.fromUser.id,
        name: r.fromUser.profile?.name || "Member",
        age: r.fromUser.profile?.age ?? null,
        city: r.fromUser.profile?.city ?? null,
        sect: r.fromUser.profile?.sect ?? null,
      },
    }))
  );
});

router.post("/:id/accept", requireAuth, async (req: AuthedRequest, res) => {
  const interest = await prisma.interestRequest.findUnique({ where: { id: req.params.id } });
  if (!interest) return res.status(404).json({ error: "not_found" });
  if (interest.toUserId !== req.userId) return res.status(403).json({ error: "forbidden" });

  const updated = await prisma.interestRequest.update({
    where: { id: interest.id },
    data: { status: "accepted" },
  });

  // Conversation is created 1:1 with the accepted interest (CONTRACT §8.1/§8.2).
  await getOrCreateConversation(updated.id);

  const toProfile = await prisma.profile.findUnique({ where: { userId: interest.toUserId } });
  await createNotification({
    userId: interest.fromUserId,
    type: "request_accepted",
    title: "Request accepted",
    message: `${toProfile?.name || "Someone"} accepted your connection request.`,
    referenceId: interest.toUserId,
    fromUserId: interest.toUserId,
    push: true,
  });

  res.json(updated);
});

router.post("/:id/decline", requireAuth, async (req: AuthedRequest, res) => {
  const interest = await prisma.interestRequest.findUnique({ where: { id: req.params.id } });
  if (!interest) return res.status(404).json({ error: "not_found" });
  if (interest.toUserId !== req.userId) return res.status(403).json({ error: "forbidden" });

  const updated = await prisma.interestRequest.update({
    where: { id: interest.id },
    data: { status: "declined" },
  });
  res.json(updated);
});

export default router;
