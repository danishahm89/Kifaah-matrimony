import { Gender, Profile } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { appConfig } from "../lib/appConfig";
import { blockedUserIdsFor } from "./blocks";
import { createNotification } from "../lib/notifications";

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

/**
 * Plain-language reasons behind the score, in the same order as the points
 * above — shown as "Why this match" on Discover cards. Uses the exact same
 * checks as computeScore so the two never disagree.
 */
export function matchReasons(
  viewer: Pick<Profile, "city" | "sect" | "prayer" | "profField"> | null | undefined,
  candidate: Pick<Profile, "city" | "sect" | "prayer" | "profField"> | null | undefined
): string[] {
  const reasons: string[] = [];
  if (!viewer || !candidate) return reasons;
  if (candidate.city && viewer.city && candidate.city === viewer.city) reasons.push("same_city");
  if (candidate.sect && viewer.sect && candidate.sect === viewer.sect) reasons.push("same_sect");
  if (candidate.prayer && viewer.prayer && candidate.prayer === viewer.prayer) reasons.push("same_prayer");
  if (
    viewer.profField &&
    candidate.profField &&
    viewer.profField.toLowerCase().includes(candidate.profField.toLowerCase().slice(0, 4))
  ) {
    reasons.push("similar_profession");
  }
  return reasons;
}

type PrefProfile = Pick<Profile, "prefMinAge" | "prefMaxAge" | "prefState" | "prefSect" | "prefMarital">;
type FitProfile = Pick<Profile, "age" | "state" | "sect" | "marital">;

/**
 * How well a candidate fits the viewer's partner preferences.
 * `set` = how many preferences the viewer has, `missed` = how many the
 * candidate does not meet (an unknown value counts as missed).
 */
export function preferenceFit(viewer: PrefProfile | null | undefined, candidate: FitProfile | null | undefined) {
  let set = 0;
  let missed = 0;
  if (!viewer) return { set, missed };
  const check = (active: boolean, ok: boolean) => {
    if (!active) return;
    set += 1;
    if (!ok) missed += 1;
  };
  const age = candidate?.age ?? null;
  check(viewer.prefMinAge != null, age != null && age >= (viewer.prefMinAge as number));
  check(viewer.prefMaxAge != null, age != null && age <= (viewer.prefMaxAge as number));
  check(!!viewer.prefState, !!candidate?.state && candidate.state === viewer.prefState);
  check(!!viewer.prefSect, !!candidate?.sect && candidate.sect === viewer.prefSect);
  check(!!viewer.prefMarital, !!candidate?.marital && candidate.marital === viewer.prefMarital);
  return { set, missed };
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
  // Blocked pairs (either direction) excluded at the query level, same as
  // discover (CONTRACT §8.3).
  for (const blockedId of await blockedUserIdsFor(userId)) {
    excluded.add(blockedId);
  }

  const candidates = await prisma.user.findMany({
    where: {
      gender: oppositeGender(viewer.gender),
      id: { notIn: Array.from(excluded) },
      suspended: false,
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
    const message = `${name} is a ${m.score}% match for you.`;
    // Port to the generalized Notification shape (CONTRACT §8.1/§8.6):
    // type: "match_suggestion", title: "New match", message unchanged,
    // referenceId: candidateId. `label` (e.g. "New signup match"/"Weekly
    // refresh") is no longer stored as its own column — it was only ever
    // used to log which run produced a match, not surfaced to the client.
    await createNotification({
      userId,
      type: "match_suggestion",
      title: "New match",
      message,
      referenceId: m.candidate.id,
      push: true,
    });
    created.push({ candidateId: m.candidate.id, score: m.score, label, text: message });
  }

  return created;
}
