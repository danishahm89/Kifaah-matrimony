import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { blockActiveConversation } from "../services/conversations";

const router = Router();

// CONTRACT §8.3 — GET /api/blocks: users blocked by the caller.
router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.blockedUser.findMany({
    where: { blockerId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  const userIds = rows.map((r) => r.blockedId);
  const profiles = await prisma.profile.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, name: true, city: true },
  });
  const profileByUserId = new Map(profiles.map((p) => [p.userId, p]));

  res.json(
    rows.map((r) => ({
      id: r.blockedId,
      name: profileByUserId.get(r.blockedId)?.name || "Member",
      city: profileByUserId.get(r.blockedId)?.city ?? null,
      createdAt: r.createdAt,
    }))
  );
});

router.post("/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const blockerId = req.userId!;
  const blockedId = req.params.userId;

  if (blockerId === blockedId) {
    return res.status(400).json({ error: "cannot_block_self" });
  }

  const target = await prisma.user.findUnique({ where: { id: blockedId } });
  if (!target) return res.status(404).json({ error: "not_found" });

  await prisma.$transaction(async (tx) => {
    await tx.blockedUser.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });

    // If a Conversation exists between the two, transition it to BLOCKED as
    // part of the same transaction (CONTRACT §8.3).
    const interest = await tx.interestRequest.findFirst({
      where: {
        status: "accepted",
        OR: [
          { fromUserId: blockerId, toUserId: blockedId },
          { fromUserId: blockedId, toUserId: blockerId },
        ],
      },
    });
    if (interest) {
      const conversation = await tx.conversation.findUnique({ where: { interestId: interest.id } });
      if (conversation) {
        await blockActiveConversation(tx, conversation.id);
      }
    }
  });

  res.status(201).json({ ok: true });
});

// Unblocking removes only the caller's own BlockedUser row (CONTRACT §8.12 —
// "unblocking a block someone else placed" has no route at all; `blockerId`
// is always the authenticated caller, never taken from the URL/body).
router.delete("/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const blockerId = req.userId!;
  const blockedId = req.params.userId;

  await prisma.blockedUser.deleteMany({ where: { blockerId, blockedId } });
  res.json({ ok: true });
});

export default router;
