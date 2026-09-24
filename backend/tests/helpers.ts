import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import { app } from "../src/app";
import { signToken } from "../src/lib/jwt";
import request from "supertest";

let counter = 0;

/** A fresh, valid-looking E.164 number per call — avoids collisions across tests/files/workers. */
export function randomPhone(): string {
  counter += 1;
  const rand = crypto.randomInt(0, 1_000_000_000).toString();
  const digits = (counter.toString() + rand).padStart(10, "7").slice(-10);
  return `+91${digits}`;
}

/**
 * Signs up (or logs in) a fresh user through the real OTP endpoints, reading
 * the code the ConsoleOtpProvider printed to the console mock. Returns the
 * token pair + created user id.
 */
export async function signUpUser(gender: "bride" | "groom" = "bride") {
  const phone = randomPhone();
  const logSpy = captureConsoleLog();

  await request(app).post("/api/auth/otp/send").send({ phone }).expect(200);
  const code = extractOtpCode(logSpy.lines, phone);
  logSpy.restore();

  const res = await request(app).post("/api/auth/otp/verify").send({ phone, code, gender }).expect(201);
  return { phone, ...res.body };
}

export function captureConsoleLog() {
  const lines: string[] = [];
  const original = console.log;
  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  return {
    lines,
    restore: () => {
      console.log = original;
    },
  };
}

export function extractOtpCode(lines: string[], phone: string): string {
  const line = lines.find((l) => l.includes(phone));
  if (!line) throw new Error(`No OTP console line found for ${phone}. Captured: ${JSON.stringify(lines)}`);
  const match = line.match(/OTP for [^:]+:\s*(\d{4,10})/);
  if (!match) throw new Error(`Could not parse OTP code from line: ${line}`);
  return match[1];
}

/** Truncates every app table — call between test files/suites that need a clean slate. */
export async function resetDb() {
  await prisma.$transaction([
    prisma.securityEvent.deleteMany(),
    prisma.waliShare.deleteMany(),
    prisma.photoAccessRequest.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.blockedUser.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.pushToken.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.interestRequest.deleteMany(),
    prisma.profile.deleteMany(),
    prisma.subscription.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export function randomToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

/**
 * Creates a user directly via Prisma (bypassing the real OTP send/verify
 * flow entirely) and signs a real JWT for it with the same `signToken` the
 * app itself uses. Used for test setup that needs many users quickly
 * without tripping the otp/verify rate limiter (which tests/rateLimit.test.ts
 * exercises directly and deliberately keeps tight) — the same pattern
 * tests/matchEngine.test.ts already uses via its own local `makeUser`.
 */
export async function createTestUser(
  gender: "bride" | "groom" = "bride",
  opts?: { name?: string; subscribed?: boolean }
) {
  const user = await prisma.user.create({
    data: {
      phone: randomPhone(),
      phoneVerified: true,
      gender: gender === "bride" ? "BRIDE" : "GROOM",
      profile: {
        create: {
          name: opts?.name ?? "Test User",
          age: 25,
          wali: gender === "bride" ? "Father — Test" : "",
        },
      },
      subscription: { create: { status: opts?.subscribed ? "active" : "inactive" } },
    },
  });
  const token = signToken({ userId: user.id });
  return { token, user: { id: user.id, phone: user.phone, gender: user.gender.toLowerCase() } };
}

/**
 * Creates two subscribed users (default bride/groom) and drives a real
 * accepted InterestRequest through the actual routes so a Conversation gets
 * created the same way production traffic creates one. Returns both
 * sessions plus the interestId.
 */
export async function makeAcceptedPair(fromGender: "bride" | "groom" = "bride", toGender: "bride" | "groom" = "groom") {
  const from = await createTestUser(fromGender, { subscribed: true, name: "From User" });
  const to = await createTestUser(toGender, { subscribed: true, name: "To User" });

  const created = await request(app)
    .post(`/api/interests/${to.user.id}`)
    .set("Authorization", `Bearer ${from.token}`)
    .send({})
    .expect(201);

  const accepted = await request(app)
    .post(`/api/interests/${created.body.id}/accept`)
    .set("Authorization", `Bearer ${to.token}`)
    .expect(200);

  return { from, to, interestId: created.body.id as string, interest: accepted.body };
}
