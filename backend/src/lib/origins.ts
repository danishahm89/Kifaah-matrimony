import { env } from "./env";

// Web origins allowed to call the API from a browser. ALLOWED_ORIGINS (comma
// separated) wins when set; otherwise these known Kifaah domains plus local
// Expo dev servers are used, so the server never falls back to "any site".
// Native apps don't send an Origin header, so they are unaffected.
const DEFAULT_ORIGINS = [
  "https://kifaah.alzakwaantours.com",
  "https://kifaah-web.srv1164487.hstgr.cloud",
  "http://localhost:8081",
  "http://localhost:19006",
];

export const allowedOrigins: string[] = env.ALLOWED_ORIGINS.length > 0 ? env.ALLOWED_ORIGINS : DEFAULT_ORIGINS;

export function isAllowedOrigin(origin: string | undefined): boolean {
  return !origin || allowedOrigins.includes(origin);
}
