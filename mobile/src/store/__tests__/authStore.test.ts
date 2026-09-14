import { useAuthStore } from '../authStore';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../../types';

const TOKEN_KEY = 'kifaah_token';
const REFRESH_TOKEN_KEY = 'kifaah_refresh_token';
const USER_KEY = 'kifaah_user';

const user: User = {
  id: 'u1',
  phone: '+919812345678',
  phoneVerified: true,
  email: null,
  gender: 'bride',
  language: 'en',
  chaperoneChat: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function resetStore() {
  useAuthStore.setState({ token: null, refreshToken: null, user: null, hydrated: false });
}

beforeEach(() => {
  // @ts-expect-error — test-only escape hatch exposed by the manual mock.
  SecureStore.__reset();
  jest.clearAllMocks();
  resetStore();
});

describe('authStore', () => {
  it('starts with an empty, unhydrated session', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.hydrated).toBe(false);
  });

  it('setSession stores the token pair and user, both in memory and in SecureStore', async () => {
    await useAuthStore.getState().setSession('access-1', 'refresh-1', user);

    const state = useAuthStore.getState();
    expect(state.token).toBe('access-1');
    expect(state.refreshToken).toBe('refresh-1');
    expect(state.user).toEqual(user);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'access-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'refresh-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(USER_KEY, JSON.stringify(user));
  });

  it('setTokens rotates the token pair (as after a refresh) without touching the stored user', async () => {
    await useAuthStore.getState().setSession('access-1', 'refresh-1', user);
    await useAuthStore.getState().setTokens('access-2', 'refresh-2');

    const state = useAuthStore.getState();
    expect(state.token).toBe('access-2');
    expect(state.refreshToken).toBe('refresh-2');
    expect(state.user).toEqual(user);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'access-2');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, 'refresh-2');
  });

  it('updateUser merges a patch into the stored user', async () => {
    await useAuthStore.getState().setSession('access-1', 'refresh-1', user);
    useAuthStore.getState().updateUser({ chaperoneChat: false });

    expect(useAuthStore.getState().user?.chaperoneChat).toBe(false);
    expect(useAuthStore.getState().user?.id).toBe('u1');
  });

  it('updateUser is a no-op when there is no current user', () => {
    useAuthStore.getState().updateUser({ chaperoneChat: false });
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('logout clears the token pair, user and SecureStore entries', async () => {
    await useAuthStore.getState().setSession('access-1', 'refresh-1', user);
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(USER_KEY);
  });

  it('hydrate reads a previously persisted session back out of SecureStore', async () => {
    await useAuthStore.getState().setSession('access-1', 'refresh-1', user);
    // Simulate a fresh app start: in-memory state reset, SecureStore keeps its contents.
    useAuthStore.setState({ token: null, refreshToken: null, user: null, hydrated: false });

    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.token).toBe('access-1');
    expect(state.refreshToken).toBe('refresh-1');
    expect(state.user).toEqual(user);
  });

  it('hydrate marks the store hydrated with a null session when nothing was persisted', async () => {
    await useAuthStore.getState().hydrate();

    const state = useAuthStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.token).toBeNull();
    expect(state.refreshToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('hydrate still marks the store hydrated even if SecureStore throws', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('no native module'));

    await useAuthStore.getState().hydrate();

    expect(useAuthStore.getState().hydrated).toBe(true);
  });
});
