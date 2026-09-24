import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, createTestUser } from "./helpers";

describe("profileComplete (CONTRACT §8.7)", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("a groom with name+age but no wali is complete (wali is optional for boys)", async () => {
    const groom = await createTestUser("groom");
    await prisma.profile.update({ where: { userId: groom.user.id }, data: { wali: "" } });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${groom.token}`).expect(200);
    expect(res.body.profile.wali).toBe("");
    expect(res.body.profileComplete).toBe(true);
  });

  it("a bride with name+age but no wali is NOT complete", async () => {
    const bride = await createTestUser("bride");
    await prisma.profile.update({ where: { userId: bride.user.id }, data: { wali: "" } });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${bride.token}`).expect(200);
    expect(res.body.profileComplete).toBe(false);
  });

  it("a bride with name+age+wali IS complete", async () => {
    const bride = await createTestUser("bride");
    await prisma.profile.update({ where: { userId: bride.user.id }, data: { wali: "Father — Test" } });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${bride.token}`).expect(200);
    expect(res.body.profileComplete).toBe(true);
  });

  it("missing name or age makes either gender incomplete regardless of wali", async () => {
    const groom = await createTestUser("groom");
    await prisma.profile.update({ where: { userId: groom.user.id }, data: { name: "", age: null } });

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${groom.token}`).expect(200);
    expect(res.body.profileComplete).toBe(false);
  });
});
