import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { createOrder, verifyPaymentSignature, verifyWebhookSignature } from "../services/razorpay";
import { Billing, priceFor } from "../lib/pricing";
import { env } from "../lib/env";
import { writeAuditLog } from "../lib/audit";
import { logger } from "../lib/logger";

const router = Router();

const createOrderSchema = z.object({
  tier: z.enum(["basic", "premium"]),
  billing: z.enum(["monthly", "annual"]),
});

function addBillingPeriod(from: Date, billing: Billing): Date {
  const d = new Date(from);
  if (billing === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

router.post("/create-order", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const { tier, billing } = parsed.data;

  try {
    // Dev/test only (env.ts refuses to boot with this set in production): skip
    // the real Razorpay API and hand back a fake order the /verify route below
    // recognizes and accepts without a signature. Same subscription upsert runs
    // either way, so switching tiers/billing still only ever touches one row.
    const { order, amountPaise } =
      env.PAYMENTS_BYPASS && !env.isProduction
        ? { order: { id: `bypass_${req.userId}_${Date.now()}` }, amountPaise: priceFor(tier, billing) * 100 }
        : await createOrder(tier, billing, `kifaah_${req.userId}_${Date.now()}`);

    await prisma.subscription.upsert({
      where: { userId: req.userId! },
      update: { tier: tier.toUpperCase() as "BASIC" | "PREMIUM", billing: billing.toUpperCase() as "MONTHLY" | "ANNUAL", razorpayOrderId: order.id },
      create: {
        userId: req.userId!,
        tier: tier.toUpperCase() as "BASIC" | "PREMIUM",
        billing: billing.toUpperCase() as "MONTHLY" | "ANNUAL",
        razorpayOrderId: order.id,
      },
    });

    const bypassed = env.PAYMENTS_BYPASS && !env.isProduction;
    res.json({
      orderId: order.id,
      amount: amountPaise,
      currency: "INR",
      keyId: bypassed ? "bypass" : process.env.RAZORPAY_KEY_ID,
      bypass: bypassed,
    });
  } catch (err) {
    logger.error({ err }, "create-order failed");
    res.status(502).json({ error: "razorpay_error" });
  }
});

const verifySchema = z.object({
  orderId: z.string(),
  paymentId: z.string(),
  signature: z.string(),
});

router.post("/verify", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", details: parsed.error.flatten() });
  }
  const { orderId, paymentId, signature } = parsed.data;

  // Dev/test only (env.ts refuses to boot with this set in production): a
  // bypass-mode order (see /create-order above) carries no real Razorpay
  // signature, so accept it on the fixed sentinel signature instead. Any
  // orderId that was NOT created in bypass mode still requires the real
  // HMAC signature below — this cannot be used to forge a real payment.
  const bypassOk =
    env.PAYMENTS_BYPASS && !env.isProduction && orderId.startsWith("bypass_") && signature === "BYPASS";
  const valid = bypassOk || verifyPaymentSignature(orderId, paymentId, signature);
  if (!valid) {
    return res.status(400).json({ error: "invalid_signature" });
  }

  const existing = await prisma.subscription.findUnique({ where: { userId: req.userId! } });
  if (!existing || existing.razorpayOrderId !== orderId) {
    return res.status(400).json({ error: "order_mismatch" });
  }
  if (!existing.tier || !existing.billing) {
    return res.status(400).json({ error: "order_mismatch" });
  }

  const now = new Date();
  const subscription = await prisma.subscription.update({
    where: { userId: req.userId! },
    data: {
      status: "active",
      startedAt: now,
      renewsAt: addBillingPeriod(now, existing.billing.toLowerCase() as Billing),
      razorpayPaymentId: paymentId,
    },
  });

  await writeAuditLog({
    userId: req.userId!,
    event: "subscription_activated",
    ip: req.ip,
    metadata: { tier: subscription.tier, billing: subscription.billing, razorpayOrderId: orderId, razorpayPaymentId: paymentId },
  });

  res.json({ subscription });
});

// Webhook: raw body is attached by express.raw() middleware mounted for this
// path in src/index.ts (Razorpay signs the exact raw bytes).
router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (typeof signature !== "string") {
    return res.status(400).json({ error: "missing_signature" });
  }

  const rawBody: Buffer = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
  const valid = verifyWebhookSignature(rawBody, signature);
  if (!valid) {
    return res.status(400).json({ error: "invalid_signature" });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const event = payload.event as string | undefined;
  if (event === "payment.captured" || event === "order.paid") {
    const orderId: string | undefined =
      payload.payload?.payment?.entity?.order_id ?? payload.payload?.order?.entity?.id;
    const paymentId: string | undefined = payload.payload?.payment?.entity?.id;

    if (orderId) {
      const subscription = await prisma.subscription.findFirst({ where: { razorpayOrderId: orderId } });
      // Idempotent: only activate if not already active for this exact order/payment.
      if (subscription && !(subscription.status === "active" && subscription.razorpayPaymentId === paymentId)) {
        const now = new Date();
        const billing = (subscription.billing?.toLowerCase() as Billing) || "monthly";
        await prisma.subscription.update({
          where: { userId: subscription.userId },
          data: {
            status: "active",
            startedAt: now,
            renewsAt: addBillingPeriod(now, billing),
            razorpayPaymentId: paymentId ?? subscription.razorpayPaymentId,
          },
        });
        await writeAuditLog({
          userId: subscription.userId,
          event: "subscription_activated",
          metadata: { via: "webhook", event, razorpayOrderId: orderId, razorpayPaymentId: paymentId },
        });
      }
    }
  }

  res.json({ received: true });
});

export default router;
