import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export interface SegmentOption {
  label: string;
  value: string;
}

interface Props {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  wrap?: boolean;
}

export function SegmentRow({ options, value, onChange, wrap = true }: Props) {
  return (
    <View style={[styles.row, wrap && styles.wrap]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.seg, active ? styles.segOn : styles.segOff]}
          >
            <Text style={[styles.text, { color: active ? colors.bg : colors.ink }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  seg: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  segOn: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  segOff: {
    backgroundColor: 'transparent',
    borderColor: colors.borderStrong,
  },
  text: {
    // Prototype uses weight 700 for segmented buttons; only 400/600/800 are loaded, so
    // extraBold (800) is the closer visual match for this emphasis-level text.
    fontFamily: fonts.extraBold,
    fontSize: 12,
  },
});
