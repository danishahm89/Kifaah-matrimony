import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { computeScore, runMatchEngineForUser } from "../src/services/matchEngine";
import { resetDb, randomPhone } from "./helpers";

describe("match engine scoring formula", () => {
  it("base score is 10 with nothing in common", () => {
    const viewer = { city: "Delhi", sect: "Sunni", prayer: "5x", profField: "Tech" };
    const candidate = { city: "Mumbai", sect: "Shia", prayer: "Jumuah", profField: "Law" };
    expect(computeScore(viewer, candidate)).toBe(10);
  });

  it("adds 30 for matching city, 30 for matching sect, 20 for matching prayer", () => {
    const viewer = { city: "Delhi", sect: "Sunni", prayer: "5x", profField: null };
    const candidate = { city: "Delhi", sect: "Sunni", prayer: "5x", profField: null };
    // 10 + 30 + 30 + 20 = 90
    expect(computeScore(viewer, candidate)).toBe(90);
  });

  it("adds 10 when profField prefixes overlap (case-insensitive, 4-char slice)", () => {
    const viewer = { city: null, sect: null, prayer: null, profField: "Technology" };
    const candidate = { city: null, sect: null, prayer: null, profField: "tech" };
    expect(computeScore(viewer, candidate)).toBe(20);
  });

  it("caps at 99 even if every component matches", () => {
    const viewer = { city: "Delhi", sect: "Sunni", prayer: "5x", profField: "Technology" };
    const candidate = { city: "Delhi", sect: "Sunni", prayer: "5x", profField: "tech" };
    // 10 + 30 + 30 + 20 + 10 = 100, capped to 99
    expect(computeScore(viewer, candidate)).toBe(99);
  });

  it("handles null/undefined profiles as base score only", () => {
    expect(computeScore(null, null)).toBe(10);
    expect(computeScore(undefined, { city: "Delhi", sect: null, prayer: null, profField: null })).toBe(10);
  });
});

describe("match engine run — exclusion / min-score / top-3", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  async function makeUser(gender: "BRIDE" | "GROOM", profile: Record<string, unknown>) {
    return prisma.user.create({
      data: {
        phone: randomPhone(),
        phoneVerified: true,
        gender: gender as any,
        profile: { create: { wali: "", ...profile } },
        subscription: { create: {} },
      },
    });
  }

  it("only surfaces opposite-gender candidates scoring >= the minimum, top 3, and excludes anyone already interested-with", async () => {
    const viewer = await makeUser("BRIDE", { name: "Viewer", city: "Delhi", sect: "Sunni", prayer: "5x" });

    // 5 opposite-gender candidates with descending match quality.
    const perfect1 = await makeUser("GROOM", { name: "Perfect1", city: "Delhi", sect: "Sunni", prayer: "5x" }); // 90
    const perfect2 = await makeUser("GROOM", { name: "Perfect2", city: "Delhi", sect: "Sunni", prayer: "5x" }); // 90
    const good = await makeUser("GROOM", { name: "Good", city: "Delhi", sect: "Sunni", prayer: "Other" }); // 70
    const belowMin = await makeUser("GROOM", { name: "BelowMin", city: "Other", sect: "Other", prayer: "Other" }); // 10, below default min 40
    const excludedByInterest = await makeUser("GROOM", { name: "Excluded", city: "Delhi", sect: "Sunni", prayer: "5x" }); // 90 but excluded

    // A same-gender user who'd otherwise score perfectly must never appear.
    await makeUser("BRIDE", { name: "SameGender", city: "Delhi", sect: "Sunni", prayer: "5x" });

    await prisma.interestRequest.create({ data: { fromUserId: viewer.id, toUserId: excludedByInterest.id } });

    const created = await runMatchEngineForUser(viewer.id, "test run");

    expect(created.length).toBe(3); // top-3 cap
    const candidateIds = created.map((n) => n.candidateId);
    expect(candidateIds).not.toContain(belowMin.id);
    expect(candidateIds).not.toContain(excludedByInterest.id);
    expect(candidateIds).toEqual(
      expect.arrayContaining([perfect1.id, perfect2.id, good.id])
    );
    for (const n of created) {
      expect(n.score).toBeGreaterThanOrEqual(40);
    }
  });

  it("returns nothing when no opposite-gender candidate clears the minimum score", async () => {
    // A profile with nothing in common with anyone else in the DB scores 10
    // everywhere, below the default MATCH_ENGINE_MIN_SCORE (40).
    const viewer = await makeUser("GROOM", { name: "Lonely", city: "Nowhereville", sect: "Unique", prayer: "Unique" });
    const created = await runMatchEngineForUser(viewer.id, "test run 2");
    expect(created).toEqual([]);
  });
});
