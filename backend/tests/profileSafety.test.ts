import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, createTestUser, makeAcceptedPair } from "./helpers";
import { signPhotoUrl, verifyPhotoToken } from "../src/lib/photoUrls";

describe("Profile view safety", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("hides the Wali until the interest is mutually accepted", async () => {
    const groom = await createTestUser("groom");
    const bride = await createTestUser("bride");
    await prisma.profile.update({ where: { userId: bride.user.id }, data: { wali: "Father - Ahmed" } });

    const res = await request(app)
      .get(`/api/profiles/${bride.user.id}`)
      .set("Authorization", `Bearer ${groom.token}`)
      .expect(200);
    expect(res.body.wali).toBe("");
    expect(res.body.hasWali).toBe(true);
  });

  it("shows the Wali once the interest is accepted", async () => {
    const { from, to } = await makeAcceptedPair();
    await prisma.profile.update({ where: { userId: to.user.id }, data: { wali: "Brother - Yusuf" } });
    const res = await request(app)
      .get(`/api/profiles/${to.user.id}`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(res.body.wali).toBe("Brother - Yusuf");
  });

  it("returns 404 for a profile of the same gender", async () => {
    const a = await createTestUser("groom");
    const b = await createTestUser("groom");
    await request(app).get(`/api/profiles/${b.user.id}`).set("Authorization", `Bearer ${a.token}`).expect(404);
  });

  it("returns 404 in both directions once one side blocks", async () => {
    const groom = await createTestUser("groom");
    const bride = await createTestUser("bride");
    await prisma.blockedUser.create({ data: { blockerId: bride.user.id, blockedId: groom.user.id } });
    await request(app).get(`/api/profiles/${bride.user.id}`).set("Authorization", `Bearer ${groom.token}`).expect(404);
    await request(app).get(`/api/profiles/${groom.user.id}`).set("Authorization", `Bearer ${bride.token}`).expect(404);
  });

  it("signed photo links expire and cannot be forged", () => {
    const now = Date.now();
    const link = signPhotoUrl("/uploads/abc.jpg", now)!;
    const token = link.replace("/api/photos/", "");
    expect(verifyPhotoToken(token, now)).toBe("/uploads/abc.jpg");
    expect(verifyPhotoToken(token, now + 3 * 60 * 60 * 1000)).toBeNull();
    const [payload] = token.split(".");
    expect(verifyPhotoToken(`${payload}.forged`, now)).toBeNull();
  });
});

describe("Discover filters and paging", () => {
  it("filters by age and city and pages the results", async () => {
    const viewer = await createTestUser("groom");
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const b = await createTestUser("bride", { name: `Filter Sister ${i}` });
      await prisma.profile.update({
        where: { userId: b.user.id },
        data: { age: 22 + i, city: i < 3 ? "Aligarh" : "Delhi" },
      });
      ids.push(b.user.id);
    }

    const byCity = await request(app)
      .get("/api/discover?city=aligarh&page=1&limit=2")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(byCity.body.total).toBe(3);
    expect(byCity.body.items).toHaveLength(2);
    expect(byCity.body.hasMore).toBe(true);

    const page2 = await request(app)
      .get("/api/discover?city=Aligarh&page=2&limit=2")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(page2.body.items).toHaveLength(1);
    expect(page2.body.hasMore).toBe(false);

    const byAge = await request(app)
      .get("/api/discover?minAge=25&maxAge=26&city=Delhi&page=1")
      .set("Authorization", `Bearer ${viewer.token}`)
      .expect(200);
    expect(byAge.body.items.map((c: { age: number }) => c.age).sort()).toEqual([25, 26]);

    // Old clients (no page) still get a plain array.
    const legacy = await request(app).get("/api/discover").set("Authorization", `Bearer ${viewer.token}`).expect(200);
    expect(Array.isArray(legacy.body)).toBe(true);
  });
});
