import { useEffect } from 'react';
import { Platform } from 'react-native';
import { securityApi } from '../api/client';

// CONTRACT.md §8.10 — screenshot protection. Native only: expo-screen-capture crashes on web
// (addListener is not a function), so all its calls are guarded inside the useEffect so that
// the hook itself is always called unconditionally (no rules-of-hooks violation).
export function useScreenshotReporting(conversationId?: string, targetUserId?: string) {
  useEffect(() => {
    // Web doesn't support screen capture prevention or detection — skip silently.
    if (Platform.OS === 'web') return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const SC = require('expo-screen-capture');

        // FLAG_SECURE on Android prevents screen capture at the OS level.
        await SC.preventScreenCapture('screenshot-report').catch(() => {});

        // Android needs READ_MEDIA_IMAGES permission for the listener to fire.
        if (Platform.OS === 'android') {
          await SC.requestPermissionsAsync().catch(() => {});
        }

        // Report screenshot events to backend so the other participant is notified.
        const sub = SC.addScreenshotListener(() => {
          securityApi
            .reportScreenshot({
              conversationId,
              targetUserId,
              platform: Platform.OS as 'ios' | 'android',
            })
            .catch(() => {
              // Best-effort — a failed report should never interrupt the person's own use of the app.
            });
        });

        cleanup = () => {
          sub?.remove?.();
          SC.allowScreenCapture('screenshot-report').catch(() => {});
        };
      } catch {
        // expo-screen-capture unavailable — silently skip. Security is best-effort on this platform.
      }
    })();

    return () => cleanup?.();
  }, [conversationId, targetUserId]);
}
