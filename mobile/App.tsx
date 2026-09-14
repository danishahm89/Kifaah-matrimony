import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Import each weight from its own subpath (not the aggregate package index) so Metro only
// bundles the 3 font files this app actually uses, instead of all 18 Archivo weight/style files.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_600SemiBold } from '@expo-google-fonts/archivo/600SemiBold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';

import { queryClient } from './src/api/queryClient';
import { useAuthStore } from './src/store/authStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Toast } from './src/components/Toast';
import { colors } from './src/theme/tokens';
import { usePushNotifications } from './src/hooks/usePushNotifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_600SemiBold,
    Archivo_800ExtraBold,
  });
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Registers for push once a session exists (post-login) and handles foreground/tap receipt —
  // CONTRACT.md §7.4. Safe to call before hydration finishes: it no-ops until `token` is set.
  usePushNotifications();

  const ready = fontsLoaded && hydrated;

  const onLayout = useCallback(async () => {
    if (ready) {
      await SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) return null;

  return (
    <View style={styles.root} onLayout={onLayout}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <NavigationContainer>
            <RootNavigator />
            <Toast />
          </NavigationContainer>
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </QueryClientProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
