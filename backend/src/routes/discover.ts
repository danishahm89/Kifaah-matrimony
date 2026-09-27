import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { computeScore, matchReasons, oppositeGender, preferenceFit } from "../services/matchEngine";
import { getInterestStatus, isSubscriptionActive, isUnlocked, LOCK_MESSAGE } from "../services/visibility";
import { writeAuditLog } from "../lib/audit";
import { blockedUserIdsFor, isBlockedPair } from "../services/blocks";
import { signPhotoUrl } from "../lib/photoUrls";
import { isAdminPhone } from "../lib/admin";
import { findConversationForUsers } from "../services/conversations";
import { getPhotoAccessStatus, getIncomingPhotoRequest } from "../services/photoAccess";
import { createNotification } from "../lib/notifications";

const router = Router();

// Optional filters + paging. Without `page`, the old response (a plain array)
// is kept so older app builds keep working.
const discoverQuerySchema = z.object({
  minAge: z.coerce.number().int().min(18).max(99).optional(),
  maxAge: z.coerce.number().int().min(18).max(99).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  state: z.string().trim().min(1).max(80).optional(),
  sect: z.string().trim().min(1).max(80).optional(),
  marital: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

router.get("/discover", requireAuth, async (req: AuthedRequest, res) => {
  const q = discoverQuerySchema.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: "invalid_input", details: q.error.flatten() });
  const filters = q.data;

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
  // Blocked pairs (either direction) are excluded at the query level below,
  // not filtered from an already-fetched list (CONTRACT §8.3 — the most
  // important enforcement point).
  for (const blockedId of await blockedUserIdsFor(viewer.id)) {
    excluded.add(blockedId);
  }

  // Filters run inside the database query, not on a fetched list.
  const profileWhere: Record<string, unknown> = {};
  if (filters.minAge != null || filters.maxAge != null) {
    profileWhere.age = {
      ...(filters.minAge != null ? { gte: filters.minAge } : {}),
      ...(filters.maxAge != null ? { lte: filters.maxAge } : {}),
    };
  }
  if (filters.city) profileWhere.city = { equals: filters.city, mode: "insensitive" };
  if (filters.state) profileWhere.state = filters.state;
  if (filters.sect) profileWhere.sect = filters.sect;
  if (filters.marital) profileWhere.marital = filters.marital;

  const candidates = await prisma.user.findMany({
    where: {
      gender: oppositeGender(viewer.gender),
      id: { notIn: Array.from(excluded) },
      suspended: false,
      ...(Object.keys(profileWhere).length > 0 ? { profile: { is: profileWhere } } : {}),
    },
    include: { profile: true },
  });

  const list = candidates
    .map((c) => {
      const fit = preferenceFit(viewer.profile, c.profile);
      const reasons = matchReasons(viewer.profile, c.profile);
      if (fit.set > 0 && fit.missed === 0) reasons.unshift("fits_preferences");
      return {
      id: c.id,
      name: c.profile?.name || "Member",
      age: c.profile?.age ?? null,
      city: c.profile?.city ?? null,
      sect: c.profile?.sect ?? null,
      eduProf: c.profile?.eduProf ?? null,
      score: computeScore(viewer.profile, c.profile),
      reasons,
      prefMissed: fit.missed,
      state: c.profile?.state ?? null,
      motherTongue: c.profile?.motherTongue ?? null,
      marital: c.profile?.marital ?? null,
      photoLocked: true as const,
      };
    })
    // Members who meet more of the viewer's partner preferences come first;
    // then score >= 65 first, then descending (CONTRACT §2).
    .sort((a, b) => {
      if (a.prefMissed !== b.prefMissed) return a.prefMissed - b.prefMissed;
      const aHigh = a.score >= 65 ? 1 : 0;
      const bHigh = b.score >= 65 ? 1 : 0;
      if (aHigh !== bHigh) return bHigh - aHigh;
      return b.score - a.score;
    });

  if (filters.page == null) return res.json(list);

  const limit = filters.limit ?? 20;
  const start = (filters.page - 1) * limit;
  res.json({
    items: list.slice(start, start + limit),
    page: filters.page,
    total: list.length,
    hasMore: start + limit < list.length,
  });
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

  // Members may only open profiles of the opposite gender, and never a
  // profile on either side of a block. Both look like "not found" so a
  // blocked member cannot tell they were blocked.
  // Admins can open any profile to review a report.
  if (candidate.id !== viewer.id && !isAdminPhone(viewer.phone)) {
    if (candidate.suspended) return res.status(404).json({ error: "not_found" });
    if (candidate.gender !== oppositeGender(viewer.gender)) {
      return res.status(404).json({ error: "not_found" });
    }
    if (await isBlockedPair(viewer.id, candidate.id)) {
      return res.status(404).json({ error: "not_found" });
    }
  }

  const interestStatus = await getInterestStatus(viewer.id, candidate.id);
  const viewerSubscribed = await isSubscriptionActive(viewer.id);
  const unlocked = isUnlocked(viewerSubscribed, interestStatus);

  // CONTRACT §8.4 — photo reveal now additionally requires an *accepted*
  // PhotoAccessRequest on top of the existing subscribed+accepted gate.
  // Contact (phone/email) reveal is unchanged.
  const photoAccessStatus = await getPhotoAccessStatus(viewer.id, candidate.id);
  const photoUnlocked = unlocked && photoAccessStatus === "accepted";
  const incomingPhotoRequest = await getIncomingPhotoRequest(viewer.id, candidate.id);

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
    state: p?.state ?? null,
    motherTongue: p?.motherTongue ?? null,
    education: p?.education ?? null,
    profession: p?.profession ?? null,
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
    // Wali / family contact is private until the interest is mutually accepted.
    wali: interestStatus === "accepted" ? p?.wali || "" : "",
    hasWali: !!p?.wali,
    score: computeScore(viewer.profile, candidate.profile),
    interestStatus,
    photoUrl: photoUnlocked ? signPhotoUrl(p?.photoUrl) : null,
    photoAccessStatus,
    incomingPhotoRequest,
    contact: unlocked
      ? { phone: p?.phone ?? null, email: p?.contactEmail ?? null }
      : null,
    locked: !unlocked,
    lockMessage: unlocked ? null : LOCK_MESSAGE,
  });
});

// CONTRACT §8.4 — request the owner's consent to view their photo. Requires
// the existing unlock prerequisite (subscribed && interest mutually
// accepted) already, same discipline as the rest of the locking logic.
router.post("/profiles/:id/photo-request", requireAuth, async (req: AuthedRequest, res) => {
  const requesterId = req.userId!;
  const ownerId = req.params.id;

  if (requesterId === ownerId) {
    return res.status(400).json({ error: "cannot_request_self" });
  }

  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) return res.status(404).json({ error: "not_found" });

  const interestStatus = await getInterestStatus(requesterId, ownerId);
  const requesterSubscribed = await isSubscriptionActive(requesterId);
  if (!isUnlocked(requesterSubscribed, interestStatus)) {
    return res.status(403).json({ error: "unlock_required" });
  }

  const conversation = await findConversationForUsers(requesterId, ownerId);
  if (!conversation) {
    return res.status(403).json({ error: "unlock_required" });
  }
  // A CLOSED/BLOCKED/REOPEN_REQUESTED conversation shouldn't be able to spawn new consent
  // requests — that would undermine close's whole point of resetting approvals (CONTRACT §8.2).
  // Re-requesting is fine again once the conversation is reopened back to ACTIVE.
  if (conversation.status !== "ACTIVE") {
    return res.status(409).json({ error: "conversation_not_active" });
  }

  const existing = await prisma.photoAccessRequest.findUnique({
    where: { conversationId_requesterId: { conversationId: conversation.id, requesterId } },
  });
  if (existing) {
    return res.status(409).json({ error: "already_exists", status: existing.status });
  }

  const created = await prisma.photoAccessRequest.create({
    data: { conversationId: conversation.id, requesterId, ownerId, status: "pending" },
  });

  const requesterProfile = await prisma.profile.findUnique({ where: { userId: requesterId } });
  await createNotification({
    userId: ownerId,
    type: "photo_requested",
    title: "Photo request",
    message: `${requesterProfile?.name || "Someone"} has requested to view your profile photo.`,
    referenceId: requesterId,
    fromUserId: requesterId,
    push: true,
  });

  res.status(201).json(created);
});

export default router;
