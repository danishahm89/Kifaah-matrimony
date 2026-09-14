import rateLimit from "express-rate-limit";
import { Request } from "express";
import { appConfig } from "../lib/appConfig";

// CONTRACT §7.3: a general limiter on /api/*, plus stricter ones on the
// auth endpoints most attractive to brute-force/abuse. Thresholds live in
// config/*.yaml (appConfig.rateLimit) rather than hardcoded here.

export const generalLimiter = rateLimit({
  windowMs: appConfig.rateLimit.general.windowMs,
  limit: appConfig.rateLimit.general.limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});

// Keyed by phone number (not just IP) so one phone can't be hammered from
// many IPs, and one IP can't hammer many phones past what's reasonable.
export const otpSendLimiter = rateLimit({
  windowMs: appConfig.rateLimit.otpSend.windowMs,
  limit: appConfig.rateLimit.otpSend.limit,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const phone = typeof req.body?.phone === "string" ? req.body.phone : "unknown";
    return `${phone}:${req.ip}`;
  },
  message: { error: "rate_limited", message: "Too many OTP requests for this phone number — try again later." },
});

export const otpVerifyLimiter = rateLimit({
  windowMs: appConfig.rateLimit.otpVerify.windowMs,
  limit: appConfig.rateLimit.otpVerify.limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});

export const refreshLimiter = rateLimit({
  windowMs: appConfig.rateLimit.refresh.windowMs,
  limit: appConfig.rateLimit.refresh.limit,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited" },
});
