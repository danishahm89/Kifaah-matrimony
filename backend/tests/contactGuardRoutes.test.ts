import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, createTestUser, makeAcceptedPair } from "./helpers";

describe("contact details are blocked in chat and profile", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("rejects a chat message with a phone number and records the attempt", async () => {
    const { from, to } = await makeAcceptedPair();
    const res = await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "my whatsapp is 98765 43210" })
      .expect(422);
    expect(res.body.error).toBe("contact_details_not_allowed");
    expect(await prisma.chatMessage.count({ where: { fromUserId: from.user.id } })).toBe(0);
    expect(await prisma.securityEvent.count({ where: { userId: from.user.id, type: "contact_share_blocked" } })).toBe(1);

    await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "Assalamu alaikum" })
      .expect(201);
  });

  it("rejects an email in the About text", async () => {
    const u = await createTestUser("groom");
    const res = await request(app)
      .put("/api/profile/me")
      .set("Authorization", `Bearer ${u.token}`)
      .send({ about: "Write to me: ali.khan@gmail.com" })
      .expect(422);
    expect(res.body.field).toBe("about");
  });
});

describe("chat payment rule", () => {
  it("one paid person opens chat for both", async () => {
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom", { subscribed: false });
    const sent = await request(app).post(`/api/interests/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).send({}).expect(201);
    await request(app).post(`/api/interests/${sent.body.id}/accept`).set("Authorization", `Bearer ${b.token}`).expect(200);
    for (let i = 0; i < 7; i++) {
      await request(app).post(`/api/chats/${a.user.id}/messages`).set("Authorization", `Bearer ${b.token}`).send({ text: `salaam ${i}` }).expect(201);
    }
  });

  it("with no plan on either side, each person gets 5 free messages", async () => {
    const a = await createTestUser("bride", { subscribed: false });
    const b = await createTestUser("groom", { subscribed: false });
    // Sending an interest needs a plan, so create the accepted interest directly.
    const interest = await prisma.interestRequest.create({ data: { fromUserId: a.user.id, toUserId: b.user.id, status: "accepted" } });
    await prisma.conversation.create({ data: { interestId: interest.id } });

    for (let i = 0; i < 5; i++) {
      await request(app).post(`/api/chats/${b.user.id}/messages`).set("Authorization", `Bearer ${a.token}`).send({ text: `salaam ${i}` }).expect(201);
    }
    const sixth = await request(app)
      .post(`/api/chats/${b.user.id}/messages`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({ text: "one more" })
      .expect(403);
    expect(sixth.body.error).toBe("free_limit_reached");

    const list = await request(app).get("/api/chats").set("Authorization", `Bearer ${b.token}`).expect(200);
    const row = list.body.find((c: any) => c.userId === a.user.id);
    expect(row.canMessage).toBe(true);
    expect(row.freeMessagesLeft).toBe(5);
  });
});

describe("admin and suspension", () => {
  it("only ADMIN_PHONES can use admin routes; suspending locks the member out", async () => {
    const admin = await createTestUser("groom");
    const member = await createTestUser("bride");
    await request(app).get("/api/admin/reports").set("Authorization", `Bearer ${member.token}`).expect(403);

    process.env.ADMIN_PHONES = admin.user.phone;
    try {
      await request(app).post(`/api/reports/${member.user.id}`).set("Authorization", `Bearer ${admin.token}`).send({ reason: "fake_profile", block: false }).expect(201);
      const list = await request(app).get("/api/admin/reports").set("Authorization", `Bearer ${admin.token}`).expect(200);
      expect(list.body.some((r: any) => r.reported.id === member.user.id)).toBe(true);

      await request(app)
        .post(`/api/admin/users/${member.user.id}/suspend`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ suspended: true })
        .expect(200);
      const locked = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${member.token}`).expect(403);
      expect(locked.body.error).toBe("account_suspended");
      const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${admin.token}`).expect(200);
      expect(me.body.isAdmin).toBe(true);
    } finally {
      delete process.env.ADMIN_PHONES;
    }
  });
});
