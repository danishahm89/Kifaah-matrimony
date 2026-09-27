import React from 'react';
import { tr } from '../i18n/t';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, themedStyles } from '../theme/tokens';

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
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ hovered, pressed }: any) => [
              styles.seg,
              active ? styles.segOn : styles.segOff,
              !active && (hovered || pressed) && styles.segHover,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={[styles.text, { color: active ? colors.white : colors.ink }]}>
              {active ? '✓ ' : ''}
              {tr(opt.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  wrap: {
    flexWrap: 'wrap',
  },
  seg: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderRadius: 22,
  },
  segOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segOff: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  segHover: {
    borderColor: colors.primary,
    backgroundColor: colors.greenBg,
  },
  text: {
    // Prototype uses weight 700 for segmented buttons; only 400/600/800 are loaded, so
    // extraBold (800) is the closer visual match for this emphasis-level text.
    fontFamily: fonts.extraBold,
    fontSize: 13,
  },
}));
