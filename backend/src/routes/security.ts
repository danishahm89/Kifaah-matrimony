import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { createNotification } from "../lib/notifications";

const router = Router();

// CONTRACT §8.10 — screenshot detected client-side (iOS/Android), reported
// here for a best-effort after-the-fact alert; screenshots cannot be
// prevented on iOS, and screen recording / a second device photographing the
// screen can never be detected at all (see the mobile README / final
// report). `targetUserId` is an addition beyond the §8.10 literal body shape
// (`{conversationId?, platform}`) — needed to identify who to notify for a
// screenshot taken outside any conversation (e.g. a ProfileDetail view,
// which has no conversationId); optional, ignored when `conversationId` is
// given.
const schema = z.object({
  conversationId: z.string().optional(),
  targetUserId: z.string().optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

router.post("/screenshot-event", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const triggeredByUserId = req.userId!;
  const { platform, conversationId, targetUserId } = parsed.data;

  let affectedUserId: string | null = null;

  if (conversationId) {
    const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return res.status(404).json({ error: "not_found" });
    const interest = await prisma.interestRequest.findUnique({ where: { id: conversation.interestId } });
    if (!interest || (interest.fromUserId !== triggeredByUserId && interest.toUserId !== triggeredByUserId)) {
      return res.status(403).json({ error: "forbidden" });
    }
    affectedUserId = interest.fromUserId === triggeredByUserId ? interest.toUserId : interest.fromUserId;
  } else if (targetUserId) {
    affectedUserId = targetUserId;
  }

  await prisma.securityEvent.create({
    data: {
      userId: affectedUserId ?? triggeredByUserId,
      triggeredByUserId,
      type: "screenshot_detected",
      conversationId: conversationId ?? null,
      platform: platform ?? null,
    },
  });

  if (affectedUserId && affectedUserId !== triggeredByUserId) {
    await createNotification({
      userId: affectedUserId,
      type: "screenshot_alert",
      title: "Security alert",
      message: "Security Alert: A screenshot was detected while viewing your private conversation/profile.",
      referenceId: conversationId ?? triggeredByUserId,
      fromUserId: triggeredByUserId,
      push: true,
    });
  }

  res.status(201).json({ ok: true });
});

export default router;
