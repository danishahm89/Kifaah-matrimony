import crypto from "crypto";
import { env } from "./env";

// Profile photos are never served from a public path. The database keeps the
// storage location ("/uploads/<file>" or "/api/profile/photos/drive/<id>"), and
// each API response that is allowed to show a photo hands out a short-lived
// signed link instead. Without a valid signature the photo route returns 404,
// so a copied or guessed path is useless.

const WINDOW_SECONDS = 60 * 60; // links live for 1-2 hours

function key(): Buffer {
  return crypto.createHash("sha256").update(`photo-link:${env.JWT_SECRET}`).digest();
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", key()).update(payload).digest("base64url");
}

/** Turns a stored photo location into a signed, expiring link. */
export function signPhotoUrl(stored: string | null | undefined, nowMs = Date.now()): string | null {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  // Round the expiry to the hour so the link (and the browser cache) stays the
  // same for a while instead of changing on every request.
  const nowSec = Math.floor(nowMs / 1000);
  const exp = (Math.floor(nowSec / WINDOW_SECONDS) + 2) * WINDOW_SECONDS;
  const payload = Buffer.from(JSON.stringify({ p: stored, e: exp })).toString("base64url");
  return `/api/photos/${payload}.${sign(payload)}`;
}

/** Returns the stored location if the token is genuine and not expired, else null. */
export function verifyPhotoToken(token: string, nowMs = Date.now()): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(payload));
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const { p, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof p !== "string" || typeof e !== "number") return null;
    if (e * 1000 < nowMs) return null;
    return p;
  } catch {
    return null;
  }
}

/** New random file name for a locally stored photo (no user id in it). */
export function randomPhotoName(): string {
  return `${crypto.randomBytes(16).toString("hex")}.jpg`;
}
