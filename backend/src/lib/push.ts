import { Expo, ExpoPushMessage } from "expo-server-sdk";
import { prisma } from "./prisma";
import { logger } from "./logger";

// Expo's push service needs no account/API key on the free tier (CONTRACT
// §7.4) — this is intentionally credential-free.
const expo = new Expo();

/**
 * Looks up every PushToken for `userId` and sends them a push. Additive only
 * — never a substitute for in-app notifications/toasts, and never throws
 * into the caller (a push failure must not fail the triggering request).
 */
export async function sendPushToUser(userId: string, title: string, body: string, data?: Record<string, unknown>) {
  try {
    const tokens = await prisma.pushToken.findMany({ where: { userId } });
    if (tokens.length === 0) return;

    const messages: ExpoPushMessage[] = [];
    for (const t of tokens) {
      if (!Expo.isExpoPushToken(t.expoPushToken)) {
        logger.warn({ userId, token: t.expoPushToken }, "skipping invalid Expo push token");
        continue;
      }
      messages.push({ to: t.expoPushToken, sound: "default", title, body, data });
    }
    if (messages.length === 0) return;

    const chunks = expo.chunkPushNotifications(messages);
    const invalidTokens: string[] = [];
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
            invalidTokens.push(chunk[i].to as string);
          }
        });
      } catch (err) {
        logger.error({ err }, "expo push chunk failed");
      }
    }

    if (invalidTokens.length > 0) {
      await prisma.pushToken.deleteMany({ where: { expoPushToken: { in: invalidTokens } } });
    }
  } catch (err) {
    // Push is best-effort — never let a failure here break the request that
    // triggered it (new interest, new message, etc.).
    logger.error({ err, userId }, "sendPushToUser failed");
  }
}
