import { describe, it, expect, beforeAll } from "vitest";
import crypto from "crypto";

// Imported after process.env.RAZORPAY_KEY_SECRET/WEBHOOK_SECRET are set below —
// the module reads them lazily inside each function call (not at import
// time), so setting them in beforeAll is sufficient here.
import { verifyPaymentSignature, verifyWebhookSignature } from "../src/services/razorpay";

const KEY_SECRET = "test_key_secret_abc123";
const WEBHOOK_SECRET = "test_webhook_secret_xyz789";

describe("Razorpay signature verification", () => {
  beforeAll(() => {
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
  });

  it("accepts a correctly computed payment signature", () => {
    const orderId = "order_abc123";
    const paymentId = "pay_xyz789";
    const signature = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

    expect(verifyPaymentSignature(orderId, paymentId, signature)).toBe(true);
  });

  it("rejects a tampered payment signature", () => {
    const orderId = "order_abc123";
    const paymentId = "pay_xyz789";
    const signature = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");

    // Flip a hex character so it's the same length but not a match — mirrors
    // an attacker who knows the format but not the secret.
    const tampered = signature.slice(0, -1) + (signature.at(-1) === "0" ? "1" : "0");
    expect(verifyPaymentSignature(orderId, paymentId, tampered)).toBe(false);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const orderId = "order_abc123";
    const paymentId = "pay_xyz789";
    const wrongSignature = crypto.createHmac("sha256", "some-other-secret").update(`${orderId}|${paymentId}`).digest("hex");

    expect(verifyPaymentSignature(orderId, paymentId, wrongSignature)).toBe(false);
  });

  it("rejects a signature for a different orderId/paymentId pair than what was signed", () => {
    const signature = crypto.createHmac("sha256", KEY_SECRET).update("order_abc123|pay_xyz789").digest("hex");
    expect(verifyPaymentSignature("order_ABC123", "pay_xyz789", signature)).toBe(false);
  });

  it("accepts a correctly computed webhook signature over the raw body", () => {
    const rawBody = Buffer.from(JSON.stringify({ event: "payment.captured", payload: {} }));
    const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");
    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("rejects a webhook signature when the raw body was tampered with after signing", () => {
    const original = Buffer.from(JSON.stringify({ event: "payment.captured", payload: {} }));
    const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(original).digest("hex");
    const tamperedBody = Buffer.from(JSON.stringify({ event: "payment.captured", payload: { amount: 1 } }));
    expect(verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });
});
