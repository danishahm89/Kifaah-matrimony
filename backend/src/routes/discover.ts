import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { computeScore, oppositeGender } from "../services/matchEngine";
import { getInterestStatus, isSubscriptionActive, isUnlocked, LOCK_MESSAGE } from "../services/visibility";
import { writeAuditLog } from "../lib/audit";

const router = Router();

router.get("/discover", requireAuth, async (req: AuthedRequest, res) => {
  const viewer = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: { profile: true },
  });
  if (!viewer) return res.status(404).json({ error: "not_found" });

  const existingInterests = await prisma.interestRequest.findMany({
    where: { OR: [{ fromUserId: viewer.id }, { toUserId: viewer.id }] },
    select: { fromUserId: true, toUserId: true },
  });
  const excluded = new Set<string>([viewer.id]);
  for (const ir of existingInterests) {
    excluded.add(ir.fromUserId === viewer.id ? ir.toUserId : ir.fromUserId);
  }

  const candidates = await prisma.user.findMany({
    where: {
      gender: oppositeGender(viewer.gender),
      id: { notIn: Array.from(excluded) },
    },
    include: { profile: true },
  });

  const list = candidates
    .map((c) => ({
      id: c.id,
      name: c.profile?.name || "Member",
      age: c.profile?.age ?? null,
      city: c.profile?.city ?? null,
      sect: c.profile?.sect ?? null,
      eduProf: c.profile?.eduProf ?? null,
      score: computeScore(viewer.profile, c.profile),
      photoLocked: true as const,
    }))
    // score >= 65 sorted first, then descending — equivalent to a plain
    // descending sort since higher scores always precede lower ones, kept
    // explicit here to match CONTRACT §2's wording exactly.
    .sort((a, b) => {
      const aHigh = a.score >= 65 ? 1 : 0;
      const bHigh = b.score >= 65 ? 1 : 0;
      if (aHigh !== bHigh) return bHigh - aHigh;
      return b.score - a.score;
    });

  res.json(list);
});

router.get("/profiles/:id", requireAuth, async (req: AuthedRequest, res) => {
  const viewer = await prisma.user.findUnique({
    where: { id: req.userId! },
    include: { profile: true },
  });
  if (!viewer) return res.status(404).json({ error: "not_found" });

  const candidate = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { profile: true },
  });
  if (!candidate) return res.status(404).json({ error: "not_found" });

  const interestStatus = await getInterestStatus(viewer.id, candidate.id);
  const viewerSubscribed = await isSubscriptionActive(viewer.id);
  const unlocked = isUnlocked(viewerSubscribed, interestStatus);

  if (unlocked) {
    // AuditLog write at the first moment contact unlocks for this
    // (viewer, candidate) pair (CONTRACT §7.3) — dedup by checking whether
    // we've already logged it, since the unlock condition can flip true via
    // either side (interest acceptance or a subscription activating).
    const already = await prisma.auditLog.findFirst({
      where: {
        userId: viewer.id,
        event: "contact_unlocked",
        metadata: { path: ["candidateId"], equals: candidate.id },
      },
    });
    if (!already) {
      await writeAuditLog({
        userId: viewer.id,
        event: "contact_unlocked",
        metadata: { candidateId: candidate.id },
      });
    }
  }

  const p = candidate.profile;

  res.json({
    id: candidate.id,
    name: p?.name || "Member",
    age: p?.age ?? null,
    gender: candidate.gender.toLowerCase(),
    city: p?.city ?? null,
    sect: p?.sect ?? null,
    prayer: p?.prayer ?? null,
    modesty: p?.modesty ?? null,
    eduProf: p?.eduProf ?? null,
    profField: p?.profField ?? null,
    family: p?.family ?? null,
    height: p?.height ?? null,
    marital: p?.marital ?? null,
    about: p?.about ?? null,
    fasting: p?.fasting ?? null,
    quran: p?.quran ?? null,
    hajj: p?.hajj ?? null,
    polygamy: p?.polygamy ?? null,
    diet: p?.diet ?? null,
    dietCustom: p?.dietCustom ?? null,
    smoking: p?.smoking ?? null,
    habits: p?.habits ?? null,
    habitsCustom: p?.habitsCustom ?? null,
    likes: p?.likes ?? null,
    likesCustom: p?.likesCustom ?? null,
    dislikes: p?.dislikes ?? null,
    dislikesCustom: p?.dislikesCustom ?? null,
    wali: p?.wali || "",
    score: computeScore(viewer.profile, candidate.profile),
    interestStatus,
    photoUrl: unlocked ? p?.photoUrl ?? null : null,
    contact: unlocked
      ? { phone: p?.phone ?? null, email: p?.contactEmail ?? null }
      : null,
    locked: !unlocked,
    lockMessage: unlocked ? null : LOCK_MESSAGE,
  });
});

export default router;
