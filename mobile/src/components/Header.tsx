import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { BackChevronIcon } from '../icons';
import { useTheme } from '../theme/ThemeContext';

interface Props {
  title: string;
  onBack: () => void;
  // Optional trailing content (e.g. a "..." actions button) - additive, existing callers that omit
  // it are unaffected.
  right?: React.ReactNode;
}

// In-screen header for pushed / onboarding screens - matches the prototype's own back-button
// rows (no native-stack header chrome).
export function Header({ title, onBack, right }: Props) {
  const { colors: themeColors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: themeColors.border }]}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
        <BackChevronIcon />
      </Pressable>
      <Text style={[styles.title, { color: themeColors.ink }]} numberOfLines={1}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
