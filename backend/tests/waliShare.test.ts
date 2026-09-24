import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, makeAcceptedPair } from "./helpers";

describe("Wali sharing (CONTRACT §8.5)", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("bride-side participant can create a share; groom-side cannot", async () => {
    const { from, to } = await makeAcceptedPair("bride", "groom");

    const groomAttempt = await request(app)
      .post(`/api/chats/${from.user.id}/wali-share`)
      .set("Authorization", `Bearer ${to.token}`)
      .send({});
    expect(groomAttempt.status).toBe(403);

    const brideCreate = await request(app)
      .post(`/api/chats/${to.user.id}/wali-share`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({});
    expect(brideCreate.status).toBe(201);
    expect(brideCreate.body.token).toBeTruthy();
    expect(brideCreate.body.url).toContain(brideCreate.body.token);
    // The URL must point at this API's own real, working GET /api/wali/:token
    // route — not a placeholder domain that doesn't resolve to anything.
    expect(brideCreate.body.url).toContain("/api/wali/");
    expect(brideCreate.body.url).not.toContain("kifaah.app");
  });

  it("GET .../wali-share reflects status: none -> active -> revoked", async () => {
    const { from, to } = await makeAcceptedPair("bride", "groom");

    const none = await request(app)
      .get(`/api/chats/${to.user.id}/wali-share`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(none.body.status).toBe("none");

    await request(app).post(`/api/chats/${to.user.id}/wali-share`).set("Authorization", `Bearer ${from.token}`).send({}).expect(201);

    const active = await request(app)
      .get(`/api/chats/${to.user.id}/wali-share`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(active.body.status).toBe("active");

    await request(app).delete(`/api/chats/${to.user.id}/wali-share`).set("Authorization", `Bearer ${from.token}`).expect(200);

    const revoked = await request(app)
      .get(`/api/chats/${to.user.id}/wali-share`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(revoked.body.status).toBe("revoked");
  });

  it("DELETE .../wali-share is idempotent", async () => {
    const { from, to } = await makeAcceptedPair("bride", "groom");
    await request(app).delete(`/api/chats/${to.user.id}/wali-share`).set("Authorization", `Bearer ${from.token}`).expect(200);
    await request(app).delete(`/api/chats/${to.user.id}/wali-share`).set("Authorization", `Bearer ${from.token}`).expect(200);
  });

  it("GET /api/wali/:token is unauthenticated and returns messages + participant names for a valid, non-revoked token", async () => {
    const { from, to } = await makeAcceptedPair("bride", "groom");
    await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "as-salamu alaykum" })
      .expect(201);

    const share = await request(app)
      .post(`/api/chats/${to.user.id}/wali-share`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({})
      .expect(201);

    const view = await request(app).get(`/api/wali/${share.body.token}`).expect(200);
    expect(view.body.messages.length).toBe(1);
    expect(view.body.messages[0].text).toBe("as-salamu alaykum");
    expect(view.body.participants.from.id).toBe(from.user.id);

    // lastViewedAt got updated.
    const row = await prisma.waliShare.findUnique({ where: { accessToken: share.body.token } });
    expect(row!.lastViewedAt).not.toBeNull();
  });

  it("GET /api/wali/:token renders a minimal read-only HTML page when a browser requests it, JSON otherwise", async () => {
    const { from, to } = await makeAcceptedPair("bride", "groom");
    await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "as-salamu alaykum" })
      .expect(201);
    const share = await request(app)
      .post(`/api/chats/${to.user.id}/wali-share`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({})
      .expect(201);

    const htmlView = await request(app)
      .get(`/api/wali/${share.body.token}`)
      .set("Accept", "text/html,application/xhtml+xml")
      .expect(200);
    expect(htmlView.headers["content-type"]).toContain("text/html");
    expect(htmlView.text).toContain("as-salamu alaykum");

    const jsonView = await request(app)
      .get(`/api/wali/${share.body.token}`)
      .set("Accept", "application/json")
      .expect(200);
    expect(jsonView.headers["content-type"]).toContain("application/json");
    expect(jsonView.body.messages[0].text).toBe("as-salamu alaykum");
  });

  it("a revoked or unknown token is 404, and never exposes the conversation any other way", async () => {
    const { from, to } = await makeAcceptedPair("bride", "groom");
    const share = await request(app)
      .post(`/api/chats/${to.user.id}/wali-share`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({})
      .expect(201);

    await request(app).delete(`/api/chats/${to.user.id}/wali-share`).set("Authorization", `Bearer ${from.token}`).expect(200);

    const revokedView = await request(app).get(`/api/wali/${share.body.token}`);
    expect(revokedView.status).toBe(404);

    const unknownView = await request(app).get(`/api/wali/does-not-exist`);
    expect(unknownView.status).toBe(404);
  });
});
