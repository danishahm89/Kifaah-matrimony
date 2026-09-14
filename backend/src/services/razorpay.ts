import crypto from "crypto";
import Razorpay from "razorpay";
import { Billing, Tier, priceFor } from "../lib/pricing";

let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });
  }
  return client;
}

/**
 * Creates a Razorpay order for the given (server-priced) tier/billing combo.
 * Amount is always computed server-side from PRICING — never trust a
 * client-submitted amount.
 */
export async function createOrder(tier: Tier, billing: Billing, receipt: string) {
  const rupees = priceFor(tier, billing);
  const amountPaise = rupees * 100;

  const order = await getClient().orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt,
    notes: { tier, billing },
  });

  return { order, amountPaise };
}

/**
 * Verifies the HMAC-SHA256 signature Razorpay's checkout returns to the
 * client after a successful payment: signature = HMAC(orderId|paymentId, key_secret).
 */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return timingSafeEqualHex(expected, signature);
}

/**
 * Verifies a Razorpay webhook payload against X-Razorpay-Signature, using
 * RAZORPAY_WEBHOOK_SECRET (distinct from the key secret) per Razorpay's
 * webhook signing scheme: signature = HMAC(rawBody, webhook_secret).
 */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return timingSafeEqualHex(expected, signature);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
