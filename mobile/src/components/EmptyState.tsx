import React from 'react';
import { tr } from '../i18n/t';
import { StyleSheet, Text } from 'react-native';
import { colors, fonts, themedStyles } from '../theme/tokens';

export function EmptyState({ text }: { text: string }) {
  return <Text style={styles.text}>{tr(text)}</Text>;
}

const styles = themedStyles(() => StyleSheet.create({
  text: {
    paddingVertical: 40,
    paddingHorizontal: 24,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
}));
