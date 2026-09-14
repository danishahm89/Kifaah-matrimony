import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { signUpUser, resetDb } from "./helpers";

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
