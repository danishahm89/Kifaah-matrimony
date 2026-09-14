import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

interface Props {
  score: number;
  size?: 'chip' | 'label';
}

export function MatchChip({ score, size = 'chip' }: Props) {
  const good = score >= 65;
  const bg = good ? colors.greenBg : colors.lowBg;
  const text = good ? colors.greenText : colors.lowText;
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text, fontSize: size === 'chip' ? 10 : 11 }]}>{score}% match</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  text: {
    fontFamily: fonts.extraBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
});
