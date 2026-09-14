import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
import { useToastStore } from '../store/uiStore';
import { BellIcon } from '../icons';

// Top banner toast — dark bg, light text, small icon, auto-dismisses (~3s, handled by the store).
export function Toast() {
  const text = useToastStore((s) => s.text);
  const insets = useSafeAreaInsets();
  if (!text) return null;
  return (
    <View style={[styles.wrap, { top: insets.top + 8 }]} pointerEvents="none">
      <BellIcon size={14} color={colors.toastText} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    backgroundColor: colors.toastBg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  text: {
    color: colors.toastText,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    flex: 1,
  },
});
