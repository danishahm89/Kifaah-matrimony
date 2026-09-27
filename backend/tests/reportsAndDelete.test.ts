import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, createTestUser, makeAcceptedPair } from "./helpers";

describe("Report a member", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("stores the report, blocks by default, and hides the profile", async () => {
    const groom = await createTestUser("groom");
    const bride = await createTestUser("bride");
    const res = await request(app)
      .post(`/api/reports/${groom.user.id}`)
      .set("Authorization", `Bearer ${bride.token}`)
      .send({ reason: "fake_profile", details: "Photo is from the internet" })
      .expect(201);
    expect(res.body.blocked).toBe(true);
    const row = await prisma.report.findFirst({ where: { reporterId: bride.user.id } });
    expect(row?.reason).toBe("fake_profile");
    await request(app).get(`/api/profiles/${groom.user.id}`).set("Authorization", `Bearer ${bride.token}`).expect(404);
  });

  it("rejects an unknown reason and self-reports", async () => {
    const a = await createTestUser("groom");
    await request(app).post(`/api/reports/${a.user.id}`).set("Authorization", `Bearer ${a.token}`).send({ reason: "other" }).expect(400);
    const b = await createTestUser("bride");
    await request(app).post(`/api/reports/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).send({ reason: "nope" }).expect(400);
  });
});

describe("Delete account", () => {
  it("needs the DELETE confirmation", async () => {
    const a = await createTestUser("groom");
    await request(app).delete("/api/account").set("Authorization", `Bearer ${a.token}`).send({}).expect(400);
  });

  it("removes the member and their linked data, but keeps reports about them", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app)
      .post(`/api/reports/${from.user.id}`)
      .set("Authorization", `Bearer ${to.token}`)
      .send({ reason: "harassment", block: false })
      .expect(201);

    await request(app)
      .delete("/api/account")
      .set("Authorization", `Bearer ${from.token}`)
      .send({ confirm: "DELETE" })
      .expect(200);

    expect(await prisma.user.findUnique({ where: { id: from.user.id } })).toBeNull();
    expect(await prisma.profile.findUnique({ where: { userId: from.user.id } })).toBeNull();
    expect(await prisma.interestRequest.count({ where: { OR: [{ fromUserId: from.user.id }, { toUserId: from.user.id }] } })).toBe(0);
    expect(await prisma.report.count({ where: { reportedId: from.user.id } })).toBe(1);
    // The other member is untouched.
    expect(await prisma.user.findUnique({ where: { id: to.user.id } })).not.toBeNull();
  });
});
