// Recreates the prototype's diagonal stripe photo placeholder
// (repeating-linear-gradient(45deg, ...) grayscale(1) contrast(1.08), blurred while locked)
// using an SVG tile pattern + expo-blur overlay, since RN has no CSS blur filter.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { colors, fonts } from '../theme/tokens';
import { LockIcon } from '../icons';
import { StripePattern } from './StripePattern';

interface Props {
  width: number | string;
  height: number;
  locked?: boolean;
  lockMessage?: string;
  intensity?: number; // blur strength — thumbnail (light) vs detail (heavy)
  iconSize?: number;
}

export function PlaceholderPhoto({
  width,
  height,
  locked = true,
  lockMessage,
  intensity = 30,
  iconSize = 18,
}: Props) {
  return (
    <View style={[styles.container, { width: width as number, height }]}>
      <StripePattern />
      {locked ? <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} /> : null}
      {locked ? (
        <View style={styles.overlay}>
          <LockIcon size={iconSize} color={colors.bg} strokeWidth={2} />
          {lockMessage ? <Text style={styles.message}>{lockMessage}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(32,30,29,0.35)',
  },
  message: {
    color: colors.bg,
    fontSize: 13,
    fontFamily: fonts.extraBold,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
});
