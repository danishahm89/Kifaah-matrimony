import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../types';

const TOKEN_KEY = 'kifaah_token';
const REFRESH_TOKEN_KEY = 'kifaah_refresh_token';
const USER_KEY = 'kifaah_user';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  hydrated: boolean;
  /** Full login/signup success — stores the initial access+refresh token pair and the user. */
  setSession: (token: string, refreshToken: string, user: User) => Promise<void>;
  /** Silent token-refresh success — updates just the token pair, leaves `user` untouched. */
  setTokens: (token: string, refreshToken: string) => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  hydrated: false,

  setSession: async (token, refreshToken, user) => {
    set({ token, refreshToken, user });
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch {
      // SecureStore can fail on some simulators/web; session still works in-memory for this run.
    }
  },

  setTokens: async (token, refreshToken) => {
    set({ token, refreshToken });
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      // ignore
    }
  },

  updateUser: (patch) => {
    const current = get().user;
    if (!current) return;
    const next = { ...current, ...patch };
    set({ user: next });
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(next)).catch(() => {});
  },

  logout: async () => {
    set({ token: null, refreshToken: null, user: null });
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch {
      // ignore
    }
  },

  hydrate: async () => {
    try {
      const [token, refreshToken, userRaw] = await Promise.all([
        SecureStore.getItemAsync(TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      const user = userRaw ? (JSON.parse(userRaw) as User) : null;
      set({ token, refreshToken, user, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
