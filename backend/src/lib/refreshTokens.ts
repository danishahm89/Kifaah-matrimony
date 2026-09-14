import crypto from "crypto";
import { prisma } from "./prisma";
import { appConfig } from "./appConfig";

// Opaque refresh tokens (CONTRACT §7.1): the raw token is handed to the
// client and never stored; only its SHA-256 hash lives server-side, so a
// leaked database can't be replayed into live sessions.
export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function issueRefreshToken(userId: string) {
  const raw = generateRefreshToken();
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + appConfig.auth.refreshTokenDays * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { raw, expiresAt };
}
