// Pure state-derivation for ChatThreadScreen's conversation-lifecycle UI (CONTRACT.md §8.2/§8.8).
// Kept free of React/navigation so it's unit-testable on its own — see
// src/screens/__tests__/chatThreadState.test.ts.
import type { ConversationStatus } from '../types';

export type ChatThreadBanner =
  | { kind: 'none' }
  // ACTIVE, but canMessage is false (e.g. the other side isn't subscribed yet — CONTRACT §8.8's
  // "stale UI" fix: an accepted-but-not-both-subscribed pair is now shown, just not messageable).
  | { kind: 'limited'; reason?: string | null }
  | { kind: 'closed' }
  | { kind: 'blocked' }
  | { kind: 'reopen_requested_by_me' }
  | { kind: 'reopen_requested_by_them' };

export interface ChatThreadUIState {
  banner: ChatThreadBanner;
  composerEnabled: boolean;
  // "Request Reopen" is offered from CLOSED or BLOCKED (the state machine allows
  // CLOSED|BLOCKED -> REOPEN_REQUESTED — CONTRACT §8.2), but not while one is already pending.
  showRequestReopen: boolean;
  // "Close Conversation" is only a listed transition from ACTIVE or BLOCKED.
  showClose: boolean;
  // Accept/Reject only ever shown to the participant who did NOT request the reopen.
  showReopenRespond: boolean;
}

export function deriveChatThreadState(params: {
  status?: ConversationStatus;
  canMessage?: boolean;
  canMessageReason?: string | null;
  reopenRequestedByUserId?: string | null;
  myUserId?: string | null;
}): ChatThreadUIState {
  // Both default to the pre-§8 behavior (open, messageable) when the backend hasn't sent them yet
  // — see ChatSummary's comment in types.ts.
  const status = params.status ?? 'active';
  const canMessage = params.canMessage ?? true;

  switch (status) {
    case 'closed':
      return {
        banner: { kind: 'closed' },
        composerEnabled: false,
        showRequestReopen: true,
        showClose: false,
        showReopenRespond: false,
      };
    case 'blocked':
      return {
        banner: { kind: 'blocked' },
        composerEnabled: false,
        showRequestReopen: true,
        showClose: false,
        showReopenRespond: false,
      };
    case 'reopen_requested': {
      const requestedByMe = !!params.reopenRequestedByUserId && params.reopenRequestedByUserId === params.myUserId;
      return {
        banner: { kind: requestedByMe ? 'reopen_requested_by_me' : 'reopen_requested_by_them' },
        composerEnabled: false,
        showRequestReopen: false,
        showClose: false,
        showReopenRespond: !requestedByMe,
      };
    }
    case 'active':
    default:
      return {
        banner: canMessage ? { kind: 'none' } : { kind: 'limited', reason: params.canMessageReason },
        composerEnabled: canMessage,
        showRequestReopen: false,
        showClose: true,
        showReopenRespond: false,
      };
  }
}
