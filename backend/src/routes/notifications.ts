import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
  });
  res.json(notifications);
});

router.post("/read-all", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.userId!, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

export default router;
