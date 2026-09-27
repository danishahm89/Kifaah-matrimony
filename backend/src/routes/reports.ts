import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { writeAuditLog } from "../lib/audit";
import { logger } from "../lib/logger";
import { blockActiveConversation } from "../services/conversations";

const router = Router();

export const REPORT_REASONS = [
  "fake_profile",
  "already_married",
  "inappropriate_photo",
  "harassment",
  "asking_money",
  "other",
] as const;

const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).optional(),
  // Reporting usually means "I never want to see this person again", so the
  // app blocks them too unless the member says otherwise.
  block: z.boolean().optional().default(true),
});

// POST /api/reports/:userId — report a member. One report per pair; sending
// again updates the reason instead of creating duplicates.
router.post("/:userId", requireAuth, async (req: AuthedRequest, res) => {
  const reporterId = req.userId!;
  const reportedId = req.params.userId;
  if (reporterId === reportedId) return res.status(400).json({ error: "cannot_report_self" });

  const parsed = reportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }

  const target = await prisma.user.findUnique({ where: { id: reportedId }, select: { id: true } });
  if (!target) return res.status(404).json({ error: "not_found" });

  const { reason, details, block } = parsed.data;
  const report = await prisma.report.upsert({
    where: { reporterId_reportedId: { reporterId, reportedId } },
    update: { reason, details: details || null, status: "open" },
    create: { reporterId, reportedId, reason, details: details || null },
  });

  if (block) {
    await prisma.$transaction(async (tx) => {
      await tx.blockedUser.upsert({
        where: { blockerId_blockedId: { blockerId: reporterId, blockedId: reportedId } },
        update: {},
        create: { blockerId: reporterId, blockedId: reportedId },
      });
      const interest = await tx.interestRequest.findFirst({
        where: {
          status: "accepted",
          OR: [
            { fromUserId: reporterId, toUserId: reportedId },
            { fromUserId: reportedId, toUserId: reporterId },
          ],
        },
      });
      if (interest) {
        const conversation = await tx.conversation.findUnique({ where: { interestId: interest.id } });
        if (conversation) await blockActiveConversation(tx, conversation.id);
      }
    });
  }

  await writeAuditLog({ userId: reporterId, event: "profile_reported", metadata: { reportedId, reason } });
  logger.warn({ reportId: report.id, reportedId, reason }, "member reported");

  res.status(201).json({ id: report.id, status: report.status, blocked: block });
});

export default router;
