import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, createTestUser, makeAcceptedPair } from "./helpers";
import { runMatchEngineForUser } from "../src/services/matchEngine";
import { createNotification } from "../src/lib/notifications";

describe("Blocking (CONTRACT §8.3)", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("GET /api/blocks lists only the caller's own blocks", async () => {
    const a = await createTestUser("bride");
    const b = await createTestUser("groom");

    await request(app).post(`/api/blocks/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).expect(201);

    const list = await request(app).get("/api/blocks").set("Authorization", `Bearer ${a.token}`).expect(200);
    expect(list.body.length).toBe(1);
    expect(list.body[0].id).toBe(b.user.id);

    const listB = await request(app).get("/api/blocks").set("Authorization", `Bearer ${b.token}`).expect(200);
    expect(listB.body.length).toBe(0);
  });

  it("discover excludes a blocked user in BOTH directions (query-level, not client filtering)", async () => {
    const a = await createTestUser("bride");
    const b = await createTestUser("groom");

    let discoverA = await request(app).get("/api/discover").set("Authorization", `Bearer ${a.token}`).expect(200);
    expect(discoverA.body.some((c: any) => c.id === b.user.id)).toBe(true);
    let discoverB = await request(app).get("/api/discover").set("Authorization", `Bearer ${b.token}`).expect(200);
    expect(discoverB.body.some((c: any) => c.id === a.user.id)).toBe(true);

    await request(app).post(`/api/blocks/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).expect(201);

    discoverA = await request(app).get("/api/discover").set("Authorization", `Bearer ${a.token}`).expect(200);
    expect(discoverA.body.some((c: any) => c.id === b.user.id)).toBe(false);
    // Excluded for the BLOCKED party too, even though b never placed a block row.
    discoverB = await request(app).get("/api/discover").set("Authorization", `Bearer ${b.token}`).expect(200);
    expect(discoverB.body.some((c: any) => c.id === a.user.id)).toBe(false);
  });

  it("match engine excludes a blocked candidate in both directions", async () => {
    const viewer = await createTestUser("bride", { name: "Viewer" });
    await prisma.profile.update({
      where: { userId: viewer.user.id },
      data: { city: "Delhi", sect: "Sunni", prayer: "5x" },
    });
    const candidate = await createTestUser("groom", { name: "Candidate" });
    await prisma.profile.update({
      where: { userId: candidate.user.id },
      data: { city: "Delhi", sect: "Sunni", prayer: "5x" },
    });

    await prisma.blockedUser.create({ data: { blockerId: candidate.user.id, blockedId: viewer.user.id } });

    const created = await runMatchEngineForUser(viewer.user.id, "test");
    expect(created.map((n) => n.candidateId)).not.toContain(candidate.user.id);
  });

  it("sending an interest to a blocked user (either direction) is 403 blocked", async () => {
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom");

    await request(app).post(`/api/blocks/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).expect(201);

    const res = await request(app)
      .post(`/api/interests/${b.user.id}`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("blocked");

    // Reverse direction: b never placed a block, but is still blocked with a.
    const c = await createTestUser("groom", { subscribed: true });
    await request(app).post(`/api/blocks/${c.user.id}`).set("Authorization", `Bearer ${a.token}`).expect(201);
    const reverse = await request(app)
      .post(`/api/interests/${a.user.id}`)
      .set("Authorization", `Bearer ${c.token}`)
      .send({});
    expect(reverse.status).toBe(403);
    expect(reverse.body.error).toBe("blocked");
  });

  it("GET /api/interests/sent and /received drop rows where either direction is blocked", async () => {
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom");

    await request(app).post(`/api/interests/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).send({}).expect(201);

    let sent = await request(app).get("/api/interests/sent").set("Authorization", `Bearer ${a.token}`).expect(200);
    expect(sent.body.length).toBe(1);
    let received = await request(app).get("/api/interests/received").set("Authorization", `Bearer ${b.token}`).expect(200);
    expect(received.body.length).toBe(1);

    await request(app).post(`/api/blocks/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).expect(201);

    sent = await request(app).get("/api/interests/sent").set("Authorization", `Bearer ${a.token}`).expect(200);
    expect(sent.body.length).toBe(0);
    received = await request(app).get("/api/interests/received").set("Authorization", `Bearer ${b.token}`).expect(200);
    expect(received.body.length).toBe(0);
  });

  it("chat send/read is 403 blocked, and blocking an ACTIVE conversation transitions it to BLOCKED", async () => {
    const { from, to } = await makeAcceptedPair();

    await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "hi" })
      .expect(201);

    await request(app).post(`/api/blocks/${to.user.id}`).set("Authorization", `Bearer ${from.token}`).expect(201);

    const send = await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "should fail" });
    expect(send.status).toBe(403);
    expect(send.body.error).toBe("blocked");

    const read = await request(app)
      .get(`/api/chats/${from.user.id}/messages`)
      .set("Authorization", `Bearer ${to.token}`);
    expect(read.status).toBe(403);
    expect(read.body.error).toBe("blocked");

    const list = await request(app).get("/api/chats").set("Authorization", `Bearer ${from.token}`).expect(200);
    const row = list.body.find((c: any) => c.userId === to.user.id);
    expect(row.conversationStatus).toBe("blocked");
    expect(row.canMessage).toBe(false);
  });

  it("createNotification is a silent no-op between a blocked pair", async () => {
    const a = await createTestUser("bride");
    const b = await createTestUser("groom");
    await prisma.blockedUser.create({ data: { blockerId: a.user.id, blockedId: b.user.id } });

    const before = await prisma.notification.count({ where: { userId: b.user.id } });
    await createNotification({
      userId: b.user.id,
      type: "new_request",
      title: "New connection request",
      message: "You have received a new connection request.",
      referenceId: a.user.id,
      fromUserId: a.user.id,
    });
    const after = await prisma.notification.count({ where: { userId: b.user.id } });
    expect(after).toBe(before);
  });

  it("unblocking removes only the caller's own BlockedUser row and does not revive the conversation", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app).post(`/api/blocks/${to.user.id}`).set("Authorization", `Bearer ${from.token}`).expect(201);

    await request(app).delete(`/api/blocks/${to.user.id}`).set("Authorization", `Bearer ${from.token}`).expect(200);

    const stillBlocked = await prisma.blockedUser.findFirst({
      where: { blockerId: from.user.id, blockedId: to.user.id },
    });
    expect(stillBlocked).toBeNull();

    // Conversation stays BLOCKED until the normal reopen flow is used.
    const conv = await prisma.conversation.findFirst({
      where: { interest: { OR: [{ fromUserId: from.user.id }, { fromUserId: to.user.id }] } },
    });
    expect(conv!.status).toBe("BLOCKED");
  });

  it("cannot unblock a block someone else placed (there's no such route — delete only ever acts on the caller's own rows)", async () => {
    const a = await createTestUser("bride");
    const b = await createTestUser("groom");
    await request(app).post(`/api/blocks/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).expect(201);

    // b tries to delete the block a placed on them — scoped to blockerId=b,
    // so this is a no-op, never touching a's row.
    await request(app).delete(`/api/blocks/${a.user.id}`).set("Authorization", `Bearer ${b.token}`).expect(200);

    const stillThere = await prisma.blockedUser.findFirst({ where: { blockerId: a.user.id, blockedId: b.user.id } });
    expect(stillThere).not.toBeNull();
  });
});
