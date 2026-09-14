import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { randomPhone } from "./helpers";

describe("rate limiting", () => {
  afterAll(async () => prisma.$disconnect());

  it("otp/send is limited per phone number (3 per 10 min)", async () => {
    const phone = randomPhone();

    const first = await request(app).post("/api/auth/otp/send").send({ phone });
    const second = await request(app).post("/api/auth/otp/send").send({ phone });
    const third = await request(app).post("/api/auth/otp/send").send({ phone });
    expect([first.status, second.status, third.status]).toEqual([200, 200, 200]);

    const fourth = await request(app).post("/api/auth/otp/send").send({ phone });
    expect(fourth.status).toBe(429);
    expect(fourth.body.error).toBe("rate_limited");
  });

  it("does not rate-limit a different phone number after another one is exhausted", async () => {
    const exhausted = randomPhone();
    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/auth/otp/send").send({ phone: exhausted });
    }
    await request(app).post("/api/auth/otp/send").send({ phone: exhausted }).expect(429);

    const other = randomPhone();
    const res = await request(app).post("/api/auth/otp/send").send({ phone: other });
    expect(res.status).toBe(200);
  });
});
