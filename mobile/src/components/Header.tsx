import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import { BackChevronIcon } from '../icons';

interface Props {
  title: string;
  onBack: () => void;
}

// In-screen header for pushed / onboarding screens — matches the prototype's own back-button
// rows (no native-stack header chrome).
export function Header({ title, onBack }: Props) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
        <BackChevronIcon />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
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
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
});
