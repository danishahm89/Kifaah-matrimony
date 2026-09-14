import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import { app } from "../src/app";
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
