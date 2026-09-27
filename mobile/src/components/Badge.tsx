import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, themedStyles } from '../theme/tokens';

// Small red count bubble for tabs. Hidden when the count is zero.
export function Badge({ count, style }: { count: number; style?: any }) {
  if (!count) return null;
  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    badge: {
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      backgroundColor: colors.red,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: { color: colors.white, fontFamily: fonts.extraBold, fontSize: 10 },
  })
);
