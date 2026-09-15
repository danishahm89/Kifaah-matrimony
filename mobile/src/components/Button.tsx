import React, { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors, fonts } from '../theme/tokens';

type Variant = 'primary' | 'surface' | 'outline' | 'text' | 'small-primary' | 'small-outline';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  align?: 'left' | 'center';
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, align = 'left' }: Props) {
  const variantStyle = VARIANT_STYLES[variant];
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() => !disabled && !loading && animateTo(0.96)}
        onPressOut={() => animateTo(1)}
        style={({ pressed }) => [
          styles.base,
          variantStyle.container,
          align === 'center' && styles.center,
          (disabled || loading) && styles.disabled,
          pressed && !disabled && !loading && styles.pressed,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyle.text.color as string} size="small" />
        ) : (
          <Text style={[styles.text, variantStyle.text]}>{title}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 0,
  },
  center: {
    alignItems: 'center',
  },
  text: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});

const VARIANT_STYLES: Record<Variant, { container: ViewStyle; text: { color: string; fontSize?: number } }> = {
  primary: {
    container: { backgroundColor: colors.red, borderWidth: 0 },
    text: { color: colors.bg },
  },
  surface: {
    container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.ink },
  },
  outline: {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong },
    text: { color: colors.ink },
  },
  text: {
    container: { backgroundColor: 'transparent', borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0 },
    text: { color: colors.redDark, fontSize: 13 },
  },
  'small-primary': {
    container: { backgroundColor: colors.red, borderWidth: 0, paddingVertical: 6, paddingHorizontal: 10 },
    text: { color: colors.bg, fontSize: 11 },
  },
  'small-outline': {
    container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.borderStrong, paddingVertical: 6, paddingHorizontal: 10 },
    text: { color: colors.ink, fontSize: 11 },
  },
};
