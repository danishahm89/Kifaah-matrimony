import React from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors } = useTheme();
  const scale = React.useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();
  };

  const VARIANT_STYLES: Record<Variant, { container: ViewStyle; text: { color: string; fontSize?: number } }> = {
    primary: {
      container: { backgroundColor: colors.primary, borderWidth: 0, borderRadius: 12 },
      text: { color: '#ffffff' },
    },
    surface: {
      container: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
      text: { color: colors.ink },
    },
    outline: {
      container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 12 },
      text: { color: colors.primary },
    },
    text: {
      container: { backgroundColor: 'transparent', borderWidth: 0, paddingVertical: 0, paddingHorizontal: 0 },
      text: { color: colors.primary, fontSize: 13 },
    },
    'small-primary': {
      container: { backgroundColor: colors.primary, borderWidth: 0, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
      text: { color: '#ffffff', fontSize: 12 },
    },
    'small-outline': {
      container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
      text: { color: colors.primary, fontSize: 12 },
    },
  };

  const variantStyle = VARIANT_STYLES[variant];

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() => {!disabled && !loading && animateTo(0.96)}}
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
    borderRadius: 12,
  },
  center: {
    alignItems: 'center',
  },
  text: {
    fontFamily: 'Archivo_800ExtraBold',
    fontSize: 15,
    color: '#ffffff',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
