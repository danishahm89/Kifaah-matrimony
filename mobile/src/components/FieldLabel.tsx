import React from 'react';
import { tr } from '../i18n/t';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts, themedStyles } from '../theme/tokens';

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{typeof children === 'string' ? tr(children) : children}</Text>;
}

const styles = themedStyles(() => StyleSheet.create({
  label: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 6,
  },
}));
