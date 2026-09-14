import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
  },
});
