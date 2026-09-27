import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
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
import type { RootStackParamList } from './src/navigation/types';
import { useAuthStore } from './src/store/authStore';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { Toast } from './src/components/Toast';
import { colors, themedStyles } from './src/theme/tokens';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

SplashScreen.preventAutoHideAsync().catch(() => {});
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [
    'https://kifaah.alzakwaantours.com',
    'https://kifaah-web.srv1164487.hstgr.cloud',
    'http://82.112.227.246:8080',
    'http://localhost:8080',
    'http://localhost:19006',
    'kifaah://',
  ],
  config: {
    screens: {
      Welcome: 'welcome',
      ShariahQA: 'onboarding/shariah',
      ProfileSetup: 'onboarding/profile',
      Main: {
        path: '',
        screens: {
          Discover: 'discover',
          Matches: 'matches',
          Chat: 'messages',
          Account: 'account',
        },
      },
      ProfileDetail: 'profile/:profileId',
      ChatThread: 'thread/:userId',
      Pricing: 'pricing',
      Payment: 'payment',
      FAQ: 'faq',
      Support: 'support',
      Health: 'health',
      Admin: 'admin',
    },
  },
};


// Screens keep their stylesheets at module level, so a theme switch remounts the navigation tree
// (keyed on the mode) to rebuild them. The current navigation state is carried over, so the person
// stays on the same screen.
function ThemedNavigation() {
  const { mode, colors: themeColors } = useTheme();
  const navState = useRef<any>(undefined);
  return (
    <View key={mode} style={{ flex: 1, backgroundColor: themeColors.bg }}>
      <NavigationContainer
        linking={linking}
        initialState={navState.current}
        onStateChange={(s) => {
          navState.current = s;
        }}
      >
        <OfflineBanner />
        <RootNavigator />
        <Toast />
      </NavigationContainer>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

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
    <ErrorBoundary>
    <View style={styles.root} onLayout={onLayout}>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <ThemedNavigation />
          </SafeAreaProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </View>
    </ErrorBoundary>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
}));
