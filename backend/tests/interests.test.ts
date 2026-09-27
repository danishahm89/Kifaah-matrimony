import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signUpUser, resetDb, createTestUser } from "./helpers";
import { expireOldInterests } from "../src/services/interestExpiry";

describe("interest accept/decline authorization", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  async function makeInterest() {
    const from = await signUpUser("bride");
    const to = await signUpUser("groom");
    const stranger = await signUpUser("groom");
    await prisma.subscription.update({ where: { userId: from.user.id }, data: { status: "active" } });

    const created = await request(app)
      .post(`/api/interests/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({})
      .expect(201);

    return { from, to, stranger, interestId: created.body.id as string };
  }

  it("only the recipient can accept an interest", async () => {
    const { from, to, stranger, interestId } = await makeInterest();

    const bySender = await request(app)
      .post(`/api/interests/${interestId}/accept`)
      .set("Authorization", `Bearer ${from.token}`);
    expect(bySender.status).toBe(403);

    const byStranger = await request(app)
      .post(`/api/interests/${interestId}/accept`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(byStranger.status).toBe(403);

    const byRecipient = await request(app)
      .post(`/api/interests/${interestId}/accept`)
      .set("Authorization", `Bearer ${to.token}`);
    expect(byRecipient.status).toBe(200);
    expect(byRecipient.body.status).toBe("accepted");
  });

  it("only the recipient can decline an interest", async () => {
    const { from, to, interestId } = await makeInterest();

    const bySender = await request(app)
      .post(`/api/interests/${interestId}/decline`)
      .set("Authorization", `Bearer ${from.token}`);
    expect(bySender.status).toBe(403);

    const byRecipient = await request(app)
      .post(`/api/interests/${interestId}/decline`)
      .set("Authorization", `Bearer ${to.token}`);
    expect(byRecipient.status).toBe(200);
    expect(byRecipient.body.status).toBe("declined");
  });

  it("accepting/declining a non-existent interest is 404", async () => {
    const { from } = await makeInterest();
    const res = await request(app)
      .post(`/api/interests/does-not-exist/accept`)
      .set("Authorization", `Bearer ${from.token}`);
    expect(res.status).toBe(404);
  });

  it("sending interest without an active subscription is rejected", async () => {
    const from = await signUpUser("bride");
    const to = await signUpUser("groom");
    const res = await request(app)
      .post(`/api/interests/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({});
    expect(res.status).toBe(402);
  });
});

describe("interest expiry", () => {
  it("expires old pending interests and lets them be sent again", async () => {
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom", { subscribed: true });
    const old = await prisma.interestRequest.create({
      data: { fromUserId: a.user.id, toUserId: b.user.id, createdAt: new Date(Date.now() - 40 * 24 * 3600 * 1000) },
    });
    expect(await expireOldInterests()).toBeGreaterThanOrEqual(1);
    expect((await prisma.interestRequest.findUnique({ where: { id: old.id } }))?.status).toBe("expired");

    const again = await request(app).post(`/api/interests/${a.user.id}`).set("Authorization", `Bearer ${b.token}`).send({});
    expect(again.status).toBe(201);
    expect(again.body.status).toBe("pending");
    expect(again.body.fromUserId).toBe(b.user.id);
  });
});
