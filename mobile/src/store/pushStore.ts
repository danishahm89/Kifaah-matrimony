import { create } from 'zustand';

// Holds the device's current Expo push token in memory only (re-derived on each app start by
// usePushNotifications) so useLogout can DELETE /api/account/push-token before clearing the
// session, per CONTRACT.md §7.4.
interface PushState {
  expoPushToken: string | null;
  setExpoPushToken: (token: string | null) => void;
}

export const usePushStore = create<PushState>((set) => ({
  expoPushToken: null,
  setExpoPushToken: (expoPushToken) => set({ expoPushToken }),
}));
