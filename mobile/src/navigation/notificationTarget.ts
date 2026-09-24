// Pure state-derivation helper (no navigation/React dependency, so it's unit-testable on its
// own — see src/navigation/__tests__/notificationTarget.test.ts): maps a generalized
// Notification (CONTRACT.md §8.6) to where tapping it should navigate.
import type { ChatSummary, NotificationItem } from '../types';

export type NotificationTarget =
  | { screen: 'ProfileDetail'; profileId: string }
  | { screen: 'ChatThread'; userId: string; name?: string }
  | { screen: 'ChatList' }
  | null;

// §8.6's table gives `referenceId`'s meaning per `type`. Every type resolves to a profile id or
// the other participant's userId except `screenshot_alert`, whose `referenceId` is a
// conversationId — the one case that can't be turned into a `ChatThread { userId }` param without
// a lookup, handled via the (optional) cached conversations list.
export function resolveNotificationTarget(
  notification: Pick<NotificationItem, 'type' | 'referenceId'>,
  conversations: ChatSummary[] = []
): NotificationTarget {
  const { type, referenceId } = notification;

  switch (type) {
    case 'match_suggestion':
    case 'new_request':
    case 'request_accepted':
    case 'photo_requested':
    case 'photo_request_accepted':
    case 'photo_request_rejected':
      return referenceId ? { screen: 'ProfileDetail', profileId: referenceId } : null;

    case 'new_message':
    case 'conversation_closed':
    case 'reopen_requested':
    case 'reopen_accepted':
    case 'reopen_rejected': {
      if (!referenceId) return null;
      const match = conversations.find((c) => c.userId === referenceId);
      return { screen: 'ChatThread', userId: referenceId, name: match?.name };
    }

    case 'screenshot_alert': {
      const match = referenceId ? conversations.find((c) => c.conversationId === referenceId) : undefined;
      return match ? { screen: 'ChatThread', userId: match.userId, name: match.name } : { screen: 'ChatList' };
    }

    default:
      return null;
  }
}
