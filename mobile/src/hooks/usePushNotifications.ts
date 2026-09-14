import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../store/authStore';
import { usePushStore } from '../store/pushStore';
import { useToastStore } from '../store/uiStore';
import { accountApi } from '../api/client';

// CONTRACT.md §7.4 — foreground notifications still show as a banner/toast (in addition to
// whatever the OS does), matching the in-app toast the rest of the app already uses.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Registers this device for push once a session exists, and wires up foreground/tap handling.
// Remote push notifications require a development or production build — Expo Go dropped support
// for them (see mobile/README.md) — so `getExpoPushTokenAsync` rejecting there is expected and
// handled as a no-op, never a crash.
export function usePushNotifications() {
  const token = useAuthStore((s) => s.token);
  const setExpoPushToken = usePushStore((s) => s.setExpoPushToken);
  const showToast = useToastStore((s) => s.show);
  const registeredForToken = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      registeredForToken.current = null;
      return;
    }
    if (registeredForToken.current === token) return;
    registeredForToken.current = token;

    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const existing = await Notifications.getPermissionsAsync();
        let status = existing.status;
        if (status !== 'granted') {
          const requested = await Notifications.requestPermissionsAsync();
          status = requested.status;
        }
        if (status !== 'granted') return;

        const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
        setExpoPushToken(expoPushToken);
        await accountApi.registerPushToken(expoPushToken);
      } catch {
        // Best-effort: unsupported in Expo Go, no physical device, simulator, permission denied,
        // or the backend call failing shouldn't ever block the rest of the app.
      }
    })();
  }, [token, setExpoPushToken]);

  useEffect(() => {
    // Foreground: also surface the existing toast banner (native OS banner is handled above).
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const text = notification.request.content.body || notification.request.content.title;
      if (text) showToast(text);
    });
    // Background tap: the OS already brings the app to the foreground on tap. Deep-linking into
    // the exact screen (e.g. a match's ProfileDetail, or a ChatThread) would need a navigation
    // ref threaded in here and a stable payload shape from the not-yet-built backend — kept out
    // per the spec's "basic tap-to-open-app is enough, don't over-engineer this".
    const responseSub = Notifications.addNotificationResponseReceivedListener(() => {});
    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, [showToast]);
}
