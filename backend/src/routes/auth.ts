import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { runMatchEngineForUser } from "../services/matchEngine";
import { otpProvider } from "../lib/otp";
import { issueRefreshToken, hashRefreshToken } from "../lib/refreshTokens";
import { writeAuditLog } from "../lib/audit";
import { otpSendLimiter, otpVerifyLimiter, refreshLimiter } from "../middleware/rateLimit";
import { logger } from "../lib/logger";

const router = Router();

// E.164 — a leading '+' followed by 8-15 digits.
const phoneSchema = z.string().regex(/^\+[1-9]\d{7,14}$/, "phone must be in E.164 format, e.g. +919812345678");

function toGenderEnum(g: "bride" | "groom") {
  return g === "bride" ? "BRIDE" : "GROOM";
}

function publicUser(user: {
  id: string;
  phone: string;
  phoneVerified: boolean;
  email: string | null;
  gender: string;
  language: string;
  chaperoneChat: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
    email: user.email,
    gender: user.gender.toLowerCase(),
    language: user.language,
    chaperoneChat: user.chaperoneChat,
    createdAt: user.createdAt,
  };
}

// CONTRACT §8.7 — real backend enforcement of "wali optional for boys":
// girls need a wali to be considered profile-complete, boys don't. Computed
// server-side so the mobile RootNavigator can switch on this instead of the
// frontend-only `!!profile.wali` check it used before.
function computeProfileComplete(user: {
  gender: string;
  profile: { name: string; age: number | null; wali: string } | null;
}): boolean {
  const profile = user.profile;
  if (!profile?.name || profile.age == null) return false;
  if (user.gender === "BRIDE" && !profile.wali) return false;
  return true;
}

const otpSendSchema = z.object({ phone: phoneSchema });

router.post("/otp/send", otpSendLimiter, async (req, res) => {
  const parsed = otpSendSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const { phone } = parsed.data;

  try {
    await otpProvider.sendCode(phone);
  } catch (err) {
    logger.error({ err }, "otp send failed");
    // Still respond ok:true — don't leak provider-side details, and don't
    // let a downstream (Twilio) hiccup reveal whether the number is valid.
  }

  // Always the same response regardless of whether an account exists for
  // this phone (CONTRACT §7.2 — don't leak account existence).
  res.json({ ok: true });
});

const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z.string().min(4).max(10),
  gender: z.enum(["bride", "groom"]).optional(),
});

router.post("/otp/verify", otpVerifyLimiter, async (req, res) => {
  const parsed = otpVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const { phone, code, gender } = parsed.data;

  const valid = await otpProvider.checkCode(phone, code);
  if (!valid) {
    await writeAuditLog({ event: "otp_verified", ip: req.ip, metadata: { phone, result: "invalid_code" } });
    return res.status(401).json({ error: "invalid_code" });
  }

  let user = await prisma.user.findUnique({ where: { phone } });
  let isNewUser = false;

  if (!user) {
    if (!gender) {
      return res.status(400).json({ error: "gender_required" });
    }
    isNewUser = true;
    user = await prisma.user.create({
      data: {
        phone,
        phoneVerified: true,
        gender: toGenderEnum(gender),
        profile: { create: { wali: "" } },
        subscription: { create: {} },
      },
    });

    // Fire-and-forget: run the match engine once right after signup, per
    // CONTRACT §2/§4. Profile is empty at this point so it will typically
    // surface nothing yet, but this keeps behavior correct once the client
    // fills the profile and re-triggers via /api/match-engine/run-now.
    runMatchEngineForUser(user.id, "New signup match").catch((err) => {
      logger.error({ err }, "match engine (signup) failed");
    });
  } else if (!user.phoneVerified) {
    user = await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  }

  const token = signToken({ userId: user.id });
  const { raw: refreshToken } = await issueRefreshToken(user.id);

  await writeAuditLog({
    userId: user.id,
    event: "otp_verified",
    ip: req.ip,
    metadata: { phone, isNewUser },
  });
  await writeAuditLog({ userId: user.id, event: "login", ip: req.ip });

  res.status(isNewUser ? 201 : 200).json({
    token,
    refreshToken,
    user: publicUser(user),
    isNewUser,
  });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

router.post("/refresh", refreshLimiter, async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const tokenHash = hashRefreshToken(parsed.data.refreshToken);

  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing) {
    return res.status(401).json({ error: "invalid_refresh_token" });
  }

  if (existing.revokedAt) {
    // Reuse of an already-rotated-away token — signal of a stolen refresh
    // token. Nuke every session for this user and force full re-auth.
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await writeAuditLog({
      userId: existing.userId,
      event: "refresh_token_reused_detected",
      ip: req.ip,
      metadata: { reusedTokenId: existing.id },
    });
    return res.status(401).json({ error: "invalid_refresh_token" });
  }

  if (existing.expiresAt.getTime() < Date.now()) {
    return res.status(401).json({ error: "invalid_refresh_token" });
  }

  const user = await prisma.user.findUnique({ where: { id: existing.userId } });
  if (!user) {
    return res.status(401).json({ error: "invalid_refresh_token" });
  }

  // Rotate: issue the new pair first, then mark the old one revoked +
  // linked, so a crash between the two steps can't destroy a valid session
  // without ever having handed out its replacement.
  const { raw: newRefreshToken } = await issueRefreshToken(user.id);
  const newHash = hashRefreshToken(newRefreshToken);
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedByTokenHash: newHash },
  });

  const token = signToken({ userId: user.id });

  res.json({ token, refreshToken: newRefreshToken, user: publicUser(user) });
});

router.post("/logout", async (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const tokenHash = hashRefreshToken(parsed.data.refreshToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (existing && !existing.revokedAt) {
    await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
    await writeAuditLog({ userId: existing.userId, event: "logout", ip: req.ip });
  }
  // Always ok — logging out a token that's already gone is a no-op, not an error.
  res.json({ ok: true });
});

router.post("/logout-all", requireAuth, async (req: AuthedRequest, res) => {
  await prisma.refreshToken.updateMany({
    where: { userId: req.userId!, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await writeAuditLog({ userId: req.userId!, event: "logout_all", ip: req.ip });
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    include: { profile: true, subscription: true },
  });
  if (!user) return res.status(404).json({ error: "not_found" });

  res.json({
    user: publicUser(user),
    profile: user.profile,
    subscription: user.subscription,
    profileComplete: computeProfileComplete(user),
  });
});

export default router;
