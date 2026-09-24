import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, createTestUser, makeAcceptedPair } from "./helpers";

describe("Photo consent flow (CONTRACT §8.4)", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("photoUrl stays null until the owner explicitly accepts a PhotoAccessRequest, even though subscribed+accepted", async () => {
    const { from, to } = await makeAcceptedPair();
    await prisma.profile.update({ where: { userId: to.user.id }, data: { photoUrl: "/uploads/fake.jpg" } });

    const before = await request(app)
      .get(`/api/profiles/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(before.body.photoUrl).toBeNull();
    expect(before.body.photoAccessStatus).toBe("none");
    // Contact reveal is unaffected by photo consent.
    expect(before.body.contact).not.toBeNull();

    const req1 = await request(app)
      .post(`/api/profiles/${to.user.id}/photo-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({});
    expect(req1.status).toBe(201);

    const pending = await request(app)
      .get(`/api/profiles/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(pending.body.photoAccessStatus).toBe("pending");
    expect(pending.body.photoUrl).toBeNull();

    const owned = await prisma.photoAccessRequest.findFirst({ where: { ownerId: to.user.id } });
    const accept = await request(app)
      .post(`/api/photo-requests/${owned!.id}/accept`)
      .set("Authorization", `Bearer ${to.token}`)
      .expect(200);
    expect(accept.body.status).toBe("accepted");

    const after = await request(app)
      .get(`/api/profiles/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(after.body.photoAccessStatus).toBe("accepted");
    expect(after.body.photoUrl).toBe("/uploads/fake.jpg");
  });

  it("request -> reject leaves the photo hidden, and a re-request after reject is rejected as already_exists (front-end shows current status)", async () => {
    const { from, to } = await makeAcceptedPair();
    await prisma.profile.update({ where: { userId: to.user.id }, data: { photoUrl: "/uploads/fake2.jpg" } });

    await request(app)
      .post(`/api/profiles/${to.user.id}/photo-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({})
      .expect(201);
    const owned = await prisma.photoAccessRequest.findFirst({ where: { ownerId: to.user.id } });

    const reject = await request(app)
      .post(`/api/photo-requests/${owned!.id}/reject`)
      .set("Authorization", `Bearer ${to.token}`)
      .expect(200);
    expect(reject.body.status).toBe("rejected");

    const profile = await request(app)
      .get(`/api/profiles/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(profile.body.photoAccessStatus).toBe("rejected");
    expect(profile.body.photoUrl).toBeNull();

    const again = await request(app)
      .post(`/api/profiles/${to.user.id}/photo-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({});
    expect(again.status).toBe(409);
  });

  it("re-request after a close+reopen starts fresh from 'none' (approval cycle reset)", async () => {
    const { from, to } = await makeAcceptedPair();

    await request(app)
      .post(`/api/profiles/${to.user.id}/photo-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({})
      .expect(201);
    let owned = await prisma.photoAccessRequest.findFirst({ where: { ownerId: to.user.id } });
    await request(app).post(`/api/photo-requests/${owned!.id}/accept`).set("Authorization", `Bearer ${to.token}`).expect(200);

    // Close then reopen the conversation.
    await request(app).post(`/api/chats/${to.user.id}/close`).set("Authorization", `Bearer ${from.token}`).expect(200);

    const remaining = await prisma.photoAccessRequest.count({ where: { ownerId: to.user.id } });
    expect(remaining).toBe(0); // reset on close

    await request(app).post(`/api/chats/${to.user.id}/reopen-request`).set("Authorization", `Bearer ${from.token}`).expect(200);
    await request(app).post(`/api/chats/${from.user.id}/reopen-request/accept`).set("Authorization", `Bearer ${to.token}`).expect(200);

    const statusAfterReopen = await request(app)
      .get(`/api/profiles/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(statusAfterReopen.body.photoAccessStatus).toBe("none");

    const fresh = await request(app)
      .post(`/api/profiles/${to.user.id}/photo-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({});
    expect(fresh.status).toBe(201);
  });

  it("409 conversation_not_active when the conversation is closed (can't spawn new consent requests while closed)", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app).post(`/api/chats/${to.user.id}/close`).set("Authorization", `Bearer ${from.token}`).expect(200);

    const res = await request(app)
      .post(`/api/profiles/${to.user.id}/photo-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("conversation_not_active");
  });

  it("403 unless the unlock prerequisite (subscribed && accepted) is met", async () => {
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom", { subscribed: true });
    // No interest sent/accepted at all.
    const res = await request(app)
      .post(`/api/profiles/${b.user.id}/photo-request`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it("the owner sees incomingPhotoRequest when viewing the requester's profile, cleared once decided", async () => {
    const { from, to } = await makeAcceptedPair();

    // Before any request: owner (`to`) viewing the requester's (`from`) profile sees nothing incoming.
    const beforeAny = await request(app)
      .get(`/api/profiles/${from.user.id}`)
      .set("Authorization", `Bearer ${to.token}`)
      .expect(200);
    expect(beforeAny.body.incomingPhotoRequest).toBeNull();

    await request(app)
      .post(`/api/profiles/${to.user.id}/photo-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({})
      .expect(201);

    const pending = await request(app)
      .get(`/api/profiles/${from.user.id}`)
      .set("Authorization", `Bearer ${to.token}`)
      .expect(200);
    expect(pending.body.incomingPhotoRequest).toMatchObject({ status: "pending" });
    expect(pending.body.incomingPhotoRequest.id).toBeTruthy();

    // The requester's own view of the owner's profile uses photoAccessStatus, not incomingPhotoRequest.
    const requesterView = await request(app)
      .get(`/api/profiles/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(requesterView.body.incomingPhotoRequest).toBeNull();
    expect(requesterView.body.photoAccessStatus).toBe("pending");

    await request(app)
      .post(`/api/photo-requests/${pending.body.incomingPhotoRequest.id}/accept`)
      .set("Authorization", `Bearer ${to.token}`)
      .expect(200);

    const afterDecision = await request(app)
      .get(`/api/profiles/${from.user.id}`)
      .set("Authorization", `Bearer ${to.token}`)
      .expect(200);
    expect(afterDecision.body.incomingPhotoRequest).toBeNull(); // only "pending" is ever surfaced here
  });

  it("accepting/rejecting a PhotoAccessRequest you don't own is 403", async () => {
    const { from, to } = await makeAcceptedPair();
    const stranger = await createTestUser("groom");

    await request(app)
      .post(`/api/profiles/${to.user.id}/photo-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({})
      .expect(201);
    const owned = await prisma.photoAccessRequest.findFirst({ where: { ownerId: to.user.id } });

    const byStranger = await request(app)
      .post(`/api/photo-requests/${owned!.id}/accept`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(byStranger.status).toBe(403);

    const byRequester = await request(app)
      .post(`/api/photo-requests/${owned!.id}/accept`)
      .set("Authorization", `Bearer ${from.token}`);
    expect(byRequester.status).toBe(403);
  });
});
