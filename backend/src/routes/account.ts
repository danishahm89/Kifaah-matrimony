import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

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

export default router;
