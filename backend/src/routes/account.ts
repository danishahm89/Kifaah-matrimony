import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import path from "path";
import fs from "fs";
import { env } from "../lib/env";
import { logger } from "../lib/logger";
import { writeAuditLog } from "../lib/audit";
import { driveConfigured, deletePhoto } from "../lib/googleDrive";

const router = Router();

const languageSchema = z.object({ language: z.enum(["en", "ur"]) });

router.put("/language", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = languageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: { language: parsed.data.language },
  });
  res.json({ language: user.language });
});

const chaperoneSchema = z.object({ chaperoneChat: z.boolean() });

router.put("/chaperone", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = chaperoneSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: { chaperoneChat: parsed.data.chaperoneChat },
  });
  res.json({ chaperoneChat: user.chaperoneChat });
});

const pushTokenSchema = z.object({ expoPushToken: z.string().min(1) });

// CONTRACT §7.4 — register/unregister this device's Expo push token for the
// caller. A token is unique per device, not per user, so upsert-by-token
// (re-registering just re-parents it to whoever is currently logged in on
// that device) and delete-by-token (called on logout).
router.post("/push-token", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const { expoPushToken } = parsed.data;

  await prisma.pushToken.upsert({
    where: { expoPushToken },
    update: { userId: req.userId! },
    create: { userId: req.userId!, expoPushToken },
  });

  res.json({ ok: true });
});

router.delete("/push-token", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = pushTokenSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  await prisma.pushToken.deleteMany({
    where: { expoPushToken: parsed.data.expoPushToken, userId: req.userId! },
  });
  res.json({ ok: true });
});

const deleteSchema = z.object({ confirm: z.literal("DELETE") });

// DELETE /api/account — the member permanently deletes their own account and
// personal data (profile, photo, messages, interests, notifications, tokens).
// Reports filed ABOUT this member are kept for moderation; reports they filed
// are removed with the rest of their data.
router.delete("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = deleteSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "confirmation_required" });

  const userId = req.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
  if (!user) return res.status(404).json({ error: "not_found" });
  const photoUrl = user.profile?.photoUrl ?? null;

  await prisma.$transaction(async (tx) => {
    const interests = await tx.interestRequest.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      select: { id: true },
    });
    const conversations = await tx.conversation.findMany({
      where: { interestId: { in: interests.map((i) => i.id) } },
      select: { id: true },
    });
    const conversationIds = conversations.map((c) => c.id);
    await tx.waliShare.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await tx.photoAccessRequest.deleteMany({ where: { conversationId: { in: conversationIds } } });
    await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    await tx.blockedUser.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
    await tx.securityEvent.deleteMany({ where: { OR: [{ userId }, { triggeredByUserId: userId }] } });
    // Other members' notifications that point at this member ("X sent you an interest").
    await tx.notification.deleteMany({ where: { referenceId: userId } });
    await tx.report.deleteMany({ where: { reporterId: userId } });
    // Cascades: profile, subscription, interests, messages, notifications, tokens.
    await tx.user.delete({ where: { id: userId } });
  });

  // Remove the photo file after the data is gone. Best effort: a failure here
  // is logged, the account is still deleted.
  try {
    if (photoUrl?.startsWith("/uploads/")) {
      await fs.promises.unlink(path.join(path.resolve(env.UPLOAD_DIR), path.basename(photoUrl)));
    } else if (photoUrl && driveConfigured) {
      const m = photoUrl.match(/\/photos\/drive\/([A-Za-z0-9_-]+)$/);
      if (m) await deletePhoto(m[1]);
    }
  } catch (err) {
    logger.warn({ err }, "could not remove photo file for deleted account");
  }

  await writeAuditLog({ userId: null, event: "account_deleted", ip: req.ip ?? null });
  res.json({ ok: true });
});

export default router;
