// Server-side source of truth for subscription pricing. Amounts are in whole
// rupees here; routes/payments.ts converts to paise for Razorpay. Never trust
// a client-submitted amount.

export type Tier = "basic" | "premium";
export type Billing = "monthly" | "annual";

export const PRICING = {
  basic: { monthly: 49, annual: 490 },
  premium: { monthly: 99, annual: 990 },
} as const;

export function priceFor(tier: Tier, billing: Billing): number {
  return PRICING[tier][billing];
}
