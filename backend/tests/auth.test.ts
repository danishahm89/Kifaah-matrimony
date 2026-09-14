import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, randomPhone, signUpUser, captureConsoleLog, extractOtpCode, randomToken } from "./helpers";

describe("OTP auth", () => {
  beforeAll(resetDb);
  afterAll(async () => prisma.$disconnect());

  it("send always responds ok:true, regardless of whether the phone has an account", async () => {
    const res = await request(app).post("/api/auth/otp/send").send({ phone: randomPhone() });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("rejects a malformed phone number", async () => {
    const res = await request(app).post("/api/auth/otp/send").send({ phone: "0123456789" });
    expect(res.status).toBe(400);
  });

  it("verify with a wrong code is rejected", async () => {
    const phone = randomPhone();
    await request(app).post("/api/auth/otp/send").send({ phone }).expect(200);
    const res = await request(app).post("/api/auth/otp/verify").send({ phone, code: "000000", gender: "bride" });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_code");
  });

  it("verify without gender for a brand-new phone is rejected with 400", async () => {
    const phone = randomPhone();
    const spy = captureConsoleLog();
    await request(app).post("/api/auth/otp/send").send({ phone }).expect(200);
    const code = extractOtpCode(spy.lines, phone);
    spy.restore();

    const res = await request(app).post("/api/auth/otp/verify").send({ phone, code });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("gender_required");
  });

  it("creates a new account on first verify and logs in on repeat verify", async () => {
    const phone = randomPhone();

    const spy1 = captureConsoleLog();
    await request(app).post("/api/auth/otp/send").send({ phone }).expect(200);
    const code1 = extractOtpCode(spy1.lines, phone);
    spy1.restore();

    const signupRes = await request(app).post("/api/auth/otp/verify").send({ phone, code: code1, gender: "groom" });
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.isNewUser).toBe(true);
    expect(signupRes.body.token).toBeTruthy();
    expect(signupRes.body.refreshToken).toBeTruthy();
    expect(signupRes.body.user.phone).toBe(phone);
    expect(signupRes.body.user.phoneVerified).toBe(true);
    expect(signupRes.body.user.gender).toBe("groom");
    expect(signupRes.body.user).not.toHaveProperty("passwordHash");

    // Log in again — same phone, new OTP round-trip, existing account.
    const spy2 = captureConsoleLog();
    await request(app).post("/api/auth/otp/send").send({ phone }).expect(200);
    const code2 = extractOtpCode(spy2.lines, phone);
    spy2.restore();

    const loginRes = await request(app).post("/api/auth/otp/verify").send({ phone, code: code2 });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.isNewUser).toBe(false);
    expect(loginRes.body.user.id).toBe(signupRes.body.user.id);
  });

  it("writes an otp_verified audit log entry on successful verify", async () => {
    const { phone } = await signUpUser();
    const row = await prisma.auditLog.findFirst({ where: { event: "otp_verified", metadata: { path: ["phone"], equals: phone } } });
    expect(row).toBeTruthy();
  });

  it("GET /api/auth/me requires auth and returns the phone-based public user", async () => {
    const { token, user } = await signUpUser();
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.phone).toBe(user.phone);
  });
});

describe("requireAuth", () => {
  afterAll(async () => prisma.$disconnect());

  it("rejects a request with no Authorization header", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage/invalid token", async () => {
    const res = await request(app).get("/api/auth/me").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(401);
  });

  it("rejects an expired token", async () => {
    const { user } = await signUpUser();
    const expired = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "dev-secret-change-me", { expiresIn: -10 });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });
});

describe("refresh token rotation + reuse detection", () => {
  afterAll(async () => prisma.$disconnect());

  it("rotates on refresh and rejects an unknown token", async () => {
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: randomToken() });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("invalid_refresh_token");
  });

  it("rotates a valid refresh token into a new pair and revokes the old one", async () => {
    const { refreshToken: original } = await signUpUser();

    const rotated = await request(app).post("/api/auth/refresh").send({ refreshToken: original });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).toBeTruthy();
    expect(rotated.body.refreshToken).not.toBe(original);
    expect(rotated.body.token).toBeTruthy();

    // The new token works.
    const second = await request(app).post("/api/auth/refresh").send({ refreshToken: rotated.body.refreshToken });
    expect(second.status).toBe(200);
  });

  it("detects reuse of an already-rotated-away token and revokes every session for that user", async () => {
    const { refreshToken: original, user } = await signUpUser();

    const rotated = await request(app).post("/api/auth/refresh").send({ refreshToken: original }).expect(200);
    const freshRefreshToken: string = rotated.body.refreshToken;

    // Reusing the now-revoked original token is a reuse-detection event.
    const reuse = await request(app).post("/api/auth/refresh").send({ refreshToken: original });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error).toBe("invalid_refresh_token");

    const auditRow = await prisma.auditLog.findFirst({
      where: { userId: user.id, event: "refresh_token_reused_detected" },
    });
    expect(auditRow).toBeTruthy();

    // The fresh (legitimately rotated) token must ALSO now be revoked —
    // reuse detection nukes every session for the user, forcing full re-auth.
    const afterReuse = await request(app).post("/api/auth/refresh").send({ refreshToken: freshRefreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it("logout revokes the given refresh token", async () => {
    const { refreshToken } = await signUpUser();
    const out = await request(app).post("/api/auth/logout").send({ refreshToken });
    expect(out.status).toBe(200);

    const again = await request(app).post("/api/auth/refresh").send({ refreshToken });
    expect(again.status).toBe(401);
  });

  it("logout-all revokes every refresh token for the caller", async () => {
    const { token, refreshToken: rt1 } = await signUpUser();
    const rotated = await request(app).post("/api/auth/refresh").send({ refreshToken: rt1 }).expect(200);
    const rt2: string = rotated.body.refreshToken;

    const out = await request(app).post("/api/auth/logout-all").set("Authorization", `Bearer ${token}`);
    expect(out.status).toBe(200);

    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: rt2 });
    expect(res.status).toBe(401);
  });
});
