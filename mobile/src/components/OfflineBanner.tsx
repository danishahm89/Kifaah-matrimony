import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { logger } from '../utils/logger';

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      // On native, use NetInfo (if available) or a simple polling approach
      let interval: ReturnType<typeof setInterval>;
      const check = async () => {
        try {
          const r = await fetch('https://www.google.com/generate_204', { method: 'HEAD', cache: 'no-store' });
          if (offline && r.ok) {
            setOffline(false);
            logger.info('Network', 'Connection restored');
          }
        } catch {
          if (!offline) {
            setOffline(true);
            logger.warn('Network', 'Connection lost');
          }
        }
      };
      interval = setInterval(check, 5000);
      return () => clearInterval(interval);
    } else {
      const onOnline  = () => { setOffline(false); logger.info('Network', 'Online'); };
      const onOffline = () => { setOffline(true);  logger.warn('Network', 'Offline'); };
      (window as any).addEventListener('online',  onOnline);
      (window as any).addEventListener('offline', onOffline);
      setOffline(!navigator.onLine);
      return () => {
        (window as any).removeEventListener('online',  onOnline);
        (window as any).removeEventListener('offline', onOffline);
      };
    }
  }, [offline]);

  if (!offline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>⚠️  No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#b91c1c',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  text: { fontFamily: fonts.semiBold, fontSize: 13, color: '#fff' },
});
