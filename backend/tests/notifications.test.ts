import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, createTestUser, makeAcceptedPair } from "./helpers";

/** Fetches the most recent Notification row for a user via the real endpoint. */
async function latestNotification(token: string) {
  const res = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`).expect(200);
  return res.body[0];
}

describe("Notification event -> row mapping (CONTRACT §8.6)", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("new interest received -> new_request, referenceId = sender's userId", async () => {
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom");

    await request(app).post(`/api/interests/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).send({}).expect(201);

    const n = await latestNotification(b.token);
    expect(n.type).toBe("new_request");
    expect(n.title).toBe("New connection request");
    expect(n.message).toBe("You have received a new connection request.");
    expect(n.referenceId).toBe(a.user.id);
  });

  it("interest accepted -> request_accepted, referenceId = accepter's userId", async () => {
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom", { subscribed: true });

    const sent = await request(app).post(`/api/interests/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).send({}).expect(201);
    await request(app).post(`/api/interests/${sent.body.id}/accept`).set("Authorization", `Bearer ${b.token}`).expect(200);

    const n = await latestNotification(a.token);
    expect(n.type).toBe("request_accepted");
    expect(n.referenceId).toBe(b.user.id);
  });

  it("new chat message -> new_message, referenceId = sender's userId", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "hello there" })
      .expect(201);

    const n = await latestNotification(to.token);
    expect(n.type).toBe("new_message");
    expect(n.referenceId).toBe(from.user.id);
    // Never leaks bio content — this assertion is really about the chat
    // message body itself being the notification body (allowed, it's a
    // message the user wrote), not about profile "about me" text ever
    // appearing here.
    expect(n.message).toBe("hello there");
  });

  it("photo requested / accepted -> photo_requested then photo_request_accepted", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app).post(`/api/profiles/${to.user.id}/photo-request`).set("Authorization", `Bearer ${from.token}`).send({}).expect(201);

    const requestedNotif = await latestNotification(to.token);
    expect(requestedNotif.type).toBe("photo_requested");
    expect(requestedNotif.referenceId).toBe(from.user.id);

    const owned = await prisma.photoAccessRequest.findFirst({ where: { ownerId: to.user.id } });
    await request(app).post(`/api/photo-requests/${owned!.id}/accept`).set("Authorization", `Bearer ${to.token}`).expect(200);

    const acceptedNotif = await latestNotification(from.token);
    expect(acceptedNotif.type).toBe("photo_request_accepted");
    expect(acceptedNotif.referenceId).toBe(to.user.id);
  });

  it("conversation closed -> conversation_closed, referenceId = the other user's id", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app).post(`/api/chats/${to.user.id}/close`).set("Authorization", `Bearer ${from.token}`).expect(200);

    const n = await latestNotification(to.token);
    expect(n.type).toBe("conversation_closed");
    expect(n.referenceId).toBe(from.user.id);
  });

  it("reopen requested / accepted -> reopen_requested then reopen_accepted", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app).post(`/api/chats/${to.user.id}/close`).set("Authorization", `Bearer ${from.token}`).expect(200);
    await request(app).post(`/api/chats/${to.user.id}/reopen-request`).set("Authorization", `Bearer ${from.token}`).expect(200);

    const requestedNotif = await latestNotification(to.token);
    expect(requestedNotif.type).toBe("reopen_requested");
    expect(requestedNotif.referenceId).toBe(from.user.id);

    await request(app).post(`/api/chats/${from.user.id}/reopen-request/accept`).set("Authorization", `Bearer ${to.token}`).expect(200);
    const acceptedNotif = await latestNotification(from.token);
    expect(acceptedNotif.type).toBe("reopen_accepted");
    expect(acceptedNotif.referenceId).toBe(to.user.id);
  });

  it("screenshot detected in a conversation -> screenshot_alert to the other participant", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await prisma.conversation.findFirst({ where: { interest: { fromUserId: from.user.id } } });

    await request(app)
      .post("/api/security/screenshot-event")
      .set("Authorization", `Bearer ${from.token}`)
      .send({ conversationId: conversation!.id, platform: "android" })
      .expect(201);

    const n = await latestNotification(to.token);
    expect(n.type).toBe("screenshot_alert");
    expect(n.title).toBe("Security alert");
    expect(n.message).toContain("screenshot was detected");

    const event = await prisma.securityEvent.findFirst({ where: { conversationId: conversation!.id } });
    expect(event!.userId).toBe(to.user.id);
    expect(event!.triggeredByUserId).toBe(from.user.id);
  });

  it("GET /api/notifications/read-all marks everything read", async () => {
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom");
    await request(app).post(`/api/interests/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).send({}).expect(201);

    await request(app).post("/api/notifications/read-all").set("Authorization", `Bearer ${b.token}`).expect(200);
    const list = await request(app).get("/api/notifications").set("Authorization", `Bearer ${b.token}`).expect(200);
    expect(list.body.every((n: any) => n.read === true)).toBe(true);
  });
});
