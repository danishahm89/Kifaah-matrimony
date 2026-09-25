import React from 'react';
import { View, useWindowDimensions, Platform, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { DESKTOP_BREAKPOINT, SIDEBAR_WIDTH } from '../navigation/MainTabNavigator';

interface Props {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
  fullWidth?: boolean;
  /** On desktop, cap the main content width */
  maxContentWidth?: number;
}

export function Screen({ children, edges = ['top'], style, fullWidth = false, maxContentWidth }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.root, { backgroundColor: colors.bg }, style]}
    >
      {fullWidth || Platform.OS !== 'web' ? (
        // Native or fullWidth web: full width
        children
      ) : isDesktop ? (
        // Desktop web: center content (sceneContainerStyle in MainTabNavigator offsets for sidebar)
        <View style={[styles.desktopContent, maxContentWidth ? { maxWidth: maxContentWidth } : {}]}>
          {children}
        </View>
      ) : (
        // Mobile web: center at 480px
        <View style={styles.mobileWebContent}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export function ScrollScreenBody({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[bodyStyles.body, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  desktopContent: {
    flex: 1,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  mobileWebContent: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    overflow: 'hidden',
  },
});

const bodyStyles = StyleSheet.create({
  body: {
    padding: 20,
    gap: 10,
  },
});
