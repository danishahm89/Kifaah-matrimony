import { create } from 'zustand';
import { Platform } from 'react-native';

// Remembers when the member last opened each conversation, so the Messages tab can show how many
// chats have something new. Kept on this device only (the backend has no read receipts yet).
const KEY = 'kifaah_chat_seen';

function load(): Record<string, string> {
  if (Platform.OS !== 'web') return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

interface ChatSeenState {
  seen: Record<string, string>;
  markSeen: (userId: string) => void;
}

export const useChatSeenStore = create<ChatSeenState>((set, get) => ({
  seen: load(),
  markSeen: (userId) => {
    const next = { ...get().seen, [userId]: new Date().toISOString() };
    set({ seen: next });
    if (Platform.OS === 'web') {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
    }
  },
}));
