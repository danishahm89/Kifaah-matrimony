import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { securityApi } from '../api/client';

// CONTRACT.md §8.10 — screenshot protection. `usePreventScreenCapture()` sets Android's
// FLAG_SECURE for as long as the owning screen is mounted (the only platform where prevention is
// actually possible — iOS/web can only ever be *notified* after the fact, never blocked).
// `useScreenshotListener` fires on both iOS and Android when one is taken; each firing is
// reported to the backend, which creates a SecurityEvent and notifies the *other* participant.
//
// LIMITATION (also documented in mobile/README.md): this cannot detect screen recording, a second
// device photographing the screen, or — on iOS — be prevented at all, only detected after the
// fact. Web is out of scope for this pass.
export function useScreenshotReporting(conversationId?: string) {
  ScreenCapture.usePreventScreenCapture();

  useEffect(() => {
    // Android additionally requires READ_MEDIA_IMAGES/READ_EXTERNAL_STORAGE to fire the
    // screenshot listener at all (iOS always resolves granted) — best-effort, silently ignored if
    // denied, since this is a supplementary security signal, never a blocking gate.
    if (Platform.OS === 'android') {
      ScreenCapture.requestPermissionsAsync().catch(() => {});
    }
  }, []);

  ScreenCapture.useScreenshotListener(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    securityApi
      .reportScreenshot({ conversationId, platform: Platform.OS })
      .catch(() => {
        // Best-effort — a failed report should never interrupt the person's own use of the app.
      });
  });
}
