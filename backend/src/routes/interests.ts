import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { isSubscriptionActive } from "../services/visibility";
import { sendPushToUser } from "../lib/push";

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

  const fromProfile = await prisma.profile.findUnique({ where: { userId: fromUserId } });
  sendPushToUser(toUserId, "New interest", `${fromProfile?.name || "Someone"} sent you an interest.`, {
    type: "interest_received",
    interestId: interest.id,
  }).catch(() => {});

  res.status(201).json(interest);
});

router.get("/sent", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.interestRequest.findMany({
    where: { fromUserId: req.userId! },
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

router.get("/received", requireAuth, async (req: AuthedRequest, res) => {
  const rows = await prisma.interestRequest.findMany({
    where: { toUserId: req.userId! },
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

  const toProfile = await prisma.profile.findUnique({ where: { userId: interest.toUserId } });
  sendPushToUser(
    interest.fromUserId,
    "Interest accepted",
    `${toProfile?.name || "Someone"} accepted your interest.`,
    { type: "interest_accepted", interestId: interest.id }
  ).catch(() => {});

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
