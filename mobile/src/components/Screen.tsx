import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  children: React.ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
}

export function Screen({ children, edges = ['top'], style }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export function ScrollScreenBody({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[bodyStyles.body, style]}>{children}</View>;
}

const bodyStyles = StyleSheet.create({
  body: {
    padding: 20,
    gap: 10,
  },
});
