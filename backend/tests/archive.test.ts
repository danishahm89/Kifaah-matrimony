import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, makeAcceptedPair } from "./helpers";
import { archiveOldClosedConversations, findConversationForUsers } from "../src/services/conversations";

describe("Six-month archive sweep (CONTRACT §8.9)", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("archives a conversation closed more than 6 months ago, leaves a recently-closed one alone", async () => {
    const oldPair = await makeAcceptedPair();
    const oldConversation = await findConversationForUsers(oldPair.from.user.id, oldPair.to.user.id);
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    await prisma.conversation.update({
      where: { id: oldConversation!.id },
      data: { status: "CLOSED", closedAt: sevenMonthsAgo },
    });

    const recentPair = await makeAcceptedPair();
    const recentConversation = await findConversationForUsers(recentPair.from.user.id, recentPair.to.user.id);
    await prisma.conversation.update({
      where: { id: recentConversation!.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });

    const count = await archiveOldClosedConversations();
    expect(count).toBeGreaterThanOrEqual(1);

    const oldAfter = await prisma.conversation.findUnique({ where: { id: oldConversation!.id } });
    expect(oldAfter!.archivedAt).not.toBeNull();

    const recentAfter = await prisma.conversation.findUnique({ where: { id: recentConversation!.id } });
    expect(recentAfter!.archivedAt).toBeNull();
  });

  it("is idempotent: running it again archives nothing new", async () => {
    const first = await archiveOldClosedConversations();
    const second = await archiveOldClosedConversations();
    expect(second).toBe(0);
    void first;
  });

  it("archived conversations are excluded from the default GET /api/chats list, reachable via ?archived=true", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await findConversationForUsers(from.user.id, to.user.id);
    const sevenMonthsAgo = new Date();
    sevenMonthsAgo.setMonth(sevenMonthsAgo.getMonth() - 7);
    await prisma.conversation.update({
      where: { id: conversation!.id },
      data: { status: "CLOSED", closedAt: sevenMonthsAgo },
    });
    await archiveOldClosedConversations();

    const defaultList = await request(app).get("/api/chats").set("Authorization", `Bearer ${from.token}`).expect(200);
    expect(defaultList.body.some((c: any) => c.userId === to.user.id)).toBe(false);

    const archivedList = await request(app)
      .get("/api/chats?archived=true")
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(archivedList.body.some((c: any) => c.userId === to.user.id)).toBe(true);

    // Messages remain queryable through it.
    const messages = await request(app)
      .get(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(Array.isArray(messages.body.messages)).toBe(true);
  });
});
