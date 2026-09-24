import { resolveNotificationTarget } from '../notificationTarget';
import type { ChatSummary } from '../../types';

const conversations: ChatSummary[] = [
  { userId: 'u1', name: 'Amina', conversationId: 'conv1' },
  { userId: 'u2', name: 'Yusuf', conversationId: 'conv2' },
];

describe('resolveNotificationTarget (CONTRACT.md §8.6)', () => {
  it.each(['match_suggestion', 'new_request', 'request_accepted', 'photo_requested', 'photo_request_accepted', 'photo_request_rejected'] as const)(
    '%s -> ProfileDetail using referenceId as the profile id',
    (type) => {
      expect(resolveNotificationTarget({ type, referenceId: 'candidate-1' })).toEqual({
        screen: 'ProfileDetail',
        profileId: 'candidate-1',
      });
    }
  );

  it.each(['new_message', 'conversation_closed', 'reopen_requested', 'reopen_accepted', 'reopen_rejected'] as const)(
    '%s -> ChatThread keyed by the other user\'s id, filling in the cached name when available',
    (type) => {
      expect(resolveNotificationTarget({ type, referenceId: 'u1' }, conversations)).toEqual({
        screen: 'ChatThread',
        userId: 'u1',
        name: 'Amina',
      });
    }
  );

  it('new_message falls back to no name when the conversation is not cached yet', () => {
    expect(resolveNotificationTarget({ type: 'new_message', referenceId: 'unknown-user' }, conversations)).toEqual({
      screen: 'ChatThread',
      userId: 'unknown-user',
      name: undefined,
    });
  });

  it('screenshot_alert resolves a conversationId referenceId against the cached list', () => {
    expect(resolveNotificationTarget({ type: 'screenshot_alert', referenceId: 'conv2' }, conversations)).toEqual({
      screen: 'ChatThread',
      userId: 'u2',
      name: 'Yusuf',
    });
  });

  it('screenshot_alert falls back to the chat list when the conversation is not cached', () => {
    expect(resolveNotificationTarget({ type: 'screenshot_alert', referenceId: 'conv-unseen' }, conversations)).toEqual({
      screen: 'ChatList',
    });
  });

  it('returns null when referenceId is missing for a type that needs one', () => {
    expect(resolveNotificationTarget({ type: 'match_suggestion', referenceId: null })).toBeNull();
    expect(resolveNotificationTarget({ type: 'new_message', referenceId: undefined })).toBeNull();
  });
});
