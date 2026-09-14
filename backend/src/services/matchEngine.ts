import { Gender, Profile } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushToUser } from "../lib/push";
import { appConfig } from "../lib/appConfig";

/**
 * Match score formula — CONTRACT.md §2, implemented exactly, do not deviate
 * from the point values:
 *
 *   score = 10
 *   score += 30 if candidate.city === viewer.city
 *   score += 30 if candidate.sect === viewer.sect
 *   score += 20 if candidate.prayer === viewer.prayer
 *   score += 10 if viewer.profField && candidate.profField &&
 *                  viewer.profField.toLowerCase().includes(candidate.profField.toLowerCase().slice(0,4))
 *   score = min(score, 99)
 */
export function computeScore(
  viewer: Pick<Profile, "city" | "sect" | "prayer" | "profField"> | null | undefined,
  candidate: Pick<Profile, "city" | "sect" | "prayer" | "profField"> | null | undefined
): number {
  let score = 10;

  if (viewer && candidate) {
    if (candidate.city && viewer.city && candidate.city === viewer.city) score += 30;
    if (candidate.sect && viewer.sect && candidate.sect === viewer.sect) score += 30;
    if (candidate.prayer && viewer.prayer && candidate.prayer === viewer.prayer) score += 20;
    if (
      viewer.profField &&
      candidate.profField &&
      viewer.profField.toLowerCase().includes(candidate.profField.toLowerCase().slice(0, 4))
    ) {
      score += 10;
    }
  }

  return Math.min(score, 99);
}

export function oppositeGender(gender: Gender): Gender {
  return gender === "BRIDE" ? "GROOM" : "BRIDE";
}

function getMinScore(): number {
  return Math.min(80, Math.max(10, appConfig.matchEngine.minScore));
}

/**
 * Score all not-yet-handled opposite-gender candidates for a user, take the
 * top 3, keep only those >= the configured minimum score, and create one
 * Notification per surfaced match. A candidate the user has already sent
 * interest to, received interest from, accepted, or declined (any
 * InterestRequest row in either direction) is excluded.
 */
export async function runMatchEngineForUser(userId: string, label: string) {
  const viewer = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!viewer) return [];

  const existingInterests = await prisma.interestRequest.findMany({
    where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
    select: { fromUserId: true, toUserId: true },
  });

  const excluded = new Set<string>([userId]);
  for (const ir of existingInterests) {
    excluded.add(ir.fromUserId === userId ? ir.toUserId : ir.fromUserId);
  }

  const candidates = await prisma.user.findMany({
    where: {
      gender: oppositeGender(viewer.gender),
      id: { notIn: Array.from(excluded) },
    },
    include: { profile: true },
  });

  const minScore = getMinScore();

  const scored = candidates
    .map((c) => ({ candidate: c, score: computeScore(viewer.profile, c.profile) }))
    .filter((s) => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const created = [];
  for (const m of scored) {
    const name = m.candidate.profile?.name || "A member";
    const notification = await prisma.notification.create({
      data: {
        userId,
        candidateId: m.candidate.id,
        score: m.score,
        label,
        text: `${name} is a ${m.score}% match for you.`,
      },
    });
    created.push(notification);

    sendPushToUser(userId, "New match", notification.text, {
      type: "new_match",
      candidateId: m.candidate.id,
    }).catch(() => {});
  }

  return created;
}
