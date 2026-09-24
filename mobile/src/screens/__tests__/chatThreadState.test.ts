import { deriveChatThreadState } from '../chatThreadState';

describe('deriveChatThreadState (CONTRACT.md §8.2/§8.8)', () => {
  it('defaults to a normal, fully-open composer when status/canMessage are unknown (pre-§8 backend)', () => {
    expect(deriveChatThreadState({})).toEqual({
      banner: { kind: 'none' },
      composerEnabled: true,
      showRequestReopen: false,
      showClose: true,
      showReopenRespond: false,
    });
  });

  it('active + canMessage:false shows the "limited" banner with its reason, composer disabled, Close still offered', () => {
    const state = deriveChatThreadState({ status: 'active', canMessage: false, canMessageReason: 'not_both_subscribed' });
    expect(state.banner).toEqual({ kind: 'limited', reason: 'not_both_subscribed' });
    expect(state.composerEnabled).toBe(false);
    expect(state.showClose).toBe(true);
    expect(state.showRequestReopen).toBe(false);
  });

  it('closed: composer disabled, Request Reopen offered, Close not offered', () => {
    const state = deriveChatThreadState({ status: 'closed' });
    expect(state.banner).toEqual({ kind: 'closed' });
    expect(state.composerEnabled).toBe(false);
    expect(state.showRequestReopen).toBe(true);
    expect(state.showClose).toBe(false);
  });

  it('blocked: composer disabled, Request Reopen still offered (BLOCKED -> REOPEN_REQUESTED is a valid transition)', () => {
    const state = deriveChatThreadState({ status: 'blocked' });
    expect(state.banner).toEqual({ kind: 'blocked' });
    expect(state.composerEnabled).toBe(false);
    expect(state.showRequestReopen).toBe(true);
  });

  it('reopen_requested by me: no respond actions, no re-request', () => {
    const state = deriveChatThreadState({ status: 'reopen_requested', reopenRequestedByUserId: 'me', myUserId: 'me' });
    expect(state.banner).toEqual({ kind: 'reopen_requested_by_me' });
    expect(state.showReopenRespond).toBe(false);
    expect(state.showRequestReopen).toBe(false);
    expect(state.composerEnabled).toBe(false);
  });

  it('reopen_requested by the other participant: Accept/Reject offered to me', () => {
    const state = deriveChatThreadState({ status: 'reopen_requested', reopenRequestedByUserId: 'them', myUserId: 'me' });
    expect(state.banner).toEqual({ kind: 'reopen_requested_by_them' });
    expect(state.showReopenRespond).toBe(true);
  });
});
