import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireAdmin, AuthedRequest } from "../middleware/auth";
import { logger } from "../lib/logger";

// Small real admin area: review member reports and suspend profiles.
const router = Router();
router.use(requireAuth, requireAdmin);

const listSchema = z.object({ status: z.enum(["open", "reviewed", "actioned", "dismissed", "all"]).optional() });

// GET /api/admin/reports?status=open — newest first, with names and how many
// times the reported member has been reported in total.
router.get("/reports", async (req: AuthedRequest, res) => {
  const q = listSchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "invalid_input" });
  const status = q.data.status ?? "open";

  const reports = await prisma.report.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const userIds = Array.from(new Set(reports.flatMap((r) => [r.reporterId, r.reportedId])));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, phone: true, gender: true, suspended: true, profile: { select: { name: true, city: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const counts = await prisma.report.groupBy({
    by: ["reportedId"],
    where: { reportedId: { in: reports.map((r) => r.reportedId) } },
    _count: { _all: true },
  });
  const countById = new Map(counts.map((c) => [c.reportedId, c._count._all]));

  const who = (id: string) => {
    const u = byId.get(id);
    return u
      ? { id, name: u.profile?.name || "Member", city: u.profile?.city ?? null, gender: u.gender.toLowerCase(), suspended: u.suspended, deleted: false }
      : { id, name: "Deleted account", city: null, gender: null, suspended: false, deleted: true };
  };

  res.json(
    reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      reporter: who(r.reporterId),
      reported: { ...who(r.reportedId), totalReports: countById.get(r.reportedId) ?? 1 },
    }))
  );
});

const updateSchema = z.object({ status: z.enum(["open", "reviewed", "actioned", "dismissed"]) });

router.post("/reports/:id", async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  const existing = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "not_found" });
  const report = await prisma.report.update({ where: { id: existing.id }, data: { status: parsed.data.status } });
  logger.info({ reportId: report.id, status: report.status, adminId: req.userId }, "report status changed");
  res.json({ id: report.id, status: report.status });
});

const suspendSchema = z.object({ suspended: z.boolean() });

// POST /api/admin/users/:id/suspend { suspended: true|false }
router.post("/users/:id/suspend", async (req: AuthedRequest, res) => {
  const parsed = suspendSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: "invalid_input" });
  if (req.params.id === req.userId) return res.status(400).json({ error: "cannot_suspend_self" });
  const user = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!user) return res.status(404).json({ error: "not_found" });

  const { suspended } = parsed.data;
  await prisma.user.update({
    where: { id: user.id },
    data: { suspended, suspendedAt: suspended ? new Date() : null },
  });
  if (suspended) {
    // Log them out everywhere.
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    // Reports about them are now dealt with.
    await prisma.report.updateMany({ where: { reportedId: user.id, status: "open" }, data: { status: "actioned" } });
  }
  logger.warn({ userId: user.id, suspended, adminId: req.userId }, "member suspension changed");
  res.json({ id: user.id, suspended });
});

// GET /api/admin/contact-attempts — members who tried to share contact
// details, most attempts first (last 30 days).
router.get("/contact-attempts", async (_req: AuthedRequest, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const grouped = await prisma.securityEvent.groupBy({
    by: ["userId"],
    where: { type: "contact_share_blocked", createdAt: { gte: since } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, suspended: true, profile: { select: { name: true, city: true } } },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  res.json(
    grouped
      .map((g) => ({
        userId: g.userId,
        name: byId.get(g.userId)?.profile?.name || "Member",
        city: byId.get(g.userId)?.profile?.city ?? null,
        suspended: byId.get(g.userId)?.suspended ?? false,
        attempts: g._count._all,
        lastAttemptAt: g._max.createdAt,
      }))
      .sort((a, b) => b.attempts - a.attempts)
  );
});

export default router;
