import { prisma } from "./prisma";
import { sendPushToUser } from "./push";
import { isBlockedPair } from "../services/blocks";

/**
 * CONTRACT §8.6 event -> Notification.type mapping. Kept as a union so a
 * typo in a call site is a compile error, not a silently-wrong row.
 */
export type NotificationType =
  | "match_suggestion"
  | "new_request"
  | "request_accepted"
  | "new_message"
  | "photo_requested"
  | "photo_request_accepted"
  | "photo_request_rejected"
  | "conversation_closed"
  | "reopen_requested"
  | "reopen_accepted"
  | "reopen_rejected"
  | "screenshot_alert";

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceId?: string | null;
  /** The other party in this notification, for the blocked-pair check. Omit for events with no natural counterpart (there are none in the §8.6 table, but kept optional for safety). */
  fromUserId?: string | null;
  push?: boolean;
}

/**
 * Creates a Notification row per the CONTRACT §8.6 mapping, and (per that
 * table's "Also push?" column) fires a best-effort push alongside it. Never
 * creates a notification between a blocked pair (§8.3/§8.6) — if
 * `fromUserId` is given and the pair is blocked at the moment of creation,
 * this is a silent no-op.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const { userId, type, title, message, referenceId, fromUserId, push = false } = input;

  if (fromUserId) {
    const blocked = await isBlockedPair(userId, fromUserId);
    if (blocked) return;
  }

  await prisma.notification.create({
    data: { userId, type, title, message, referenceId: referenceId ?? null },
  });

  if (push) {
    sendPushToUser(userId, title, message, { type, referenceId: referenceId ?? undefined }).catch(() => {});
  }
}
