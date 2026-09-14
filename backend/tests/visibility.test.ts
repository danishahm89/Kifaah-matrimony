import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../src/lib/prisma";
import { isUnlocked, canChat } from "../src/services/visibility";
import { signUpUser, resetDb } from "./helpers";

describe("visibility rules", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("isUnlocked requires both viewer subscription AND a mutually accepted interest", () => {
    expect(isUnlocked(false, "accepted")).toBe(false);
    expect(isUnlocked(true, "accepted")).toBe(true);
    expect(isUnlocked(true, "sent")).toBe(false);
    expect(isUnlocked(true, "received")).toBe(false);
    expect(isUnlocked(true, "declined")).toBe(false);
    expect(isUnlocked(true, "none")).toBe(false);
  });

  it("canChat is false with no accepted interest, even if both are subscribed", async () => {
    const a = await signUpUser("bride");
    const b = await signUpUser("groom");
    await prisma.subscription.update({ where: { userId: a.user.id }, data: { status: "active" } });
    await prisma.subscription.update({ where: { userId: b.user.id }, data: { status: "active" } });

    expect(await canChat(a.user.id, b.user.id)).toBe(false);
  });

  it("canChat requires BOTH sides subscribed, not just the accepting side", async () => {
    const a = await signUpUser("bride");
    const b = await signUpUser("groom");
    await prisma.interestRequest.create({ data: { fromUserId: a.user.id, toUserId: b.user.id, status: "accepted" } });

    // Only `a` subscribed.
    await prisma.subscription.update({ where: { userId: a.user.id }, data: { status: "active" } });
    expect(await canChat(a.user.id, b.user.id)).toBe(false);
    expect(await canChat(b.user.id, a.user.id)).toBe(false);

    // Now both subscribed.
    await prisma.subscription.update({ where: { userId: b.user.id }, data: { status: "active" } });
    expect(await canChat(a.user.id, b.user.id)).toBe(true);
    expect(await canChat(b.user.id, a.user.id)).toBe(true);
  });

  it("canChat is false once declined, even with both subscribed", async () => {
    const a = await signUpUser("bride");
    const b = await signUpUser("groom");
    await prisma.interestRequest.create({ data: { fromUserId: a.user.id, toUserId: b.user.id, status: "declined" } });
    await prisma.subscription.update({ where: { userId: a.user.id }, data: { status: "active" } });
    await prisma.subscription.update({ where: { userId: b.user.id }, data: { status: "active" } });

    expect(await canChat(a.user.id, b.user.id)).toBe(false);
  });
});
