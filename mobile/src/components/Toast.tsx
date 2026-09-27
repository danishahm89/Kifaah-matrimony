import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { useToastStore } from '../store/uiStore';

const ICON = { info: '🔔', success: '✅', error: '⚠️' } as const;

// Top banner toast. Slides and fades in, auto-dismisses (~3s, handled by the store), tap to close.
export function Toast() {
  const text = useToastStore((s) => s.text);
  const kind = useToastStore((s) => s.kind);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!text) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 80 }).start();
  }, [text, anim]);

  if (!text) return null;
  const accent = kind === 'error' ? colors.red : kind === 'success' ? colors.primary : colors.accent;
  return (
    <Animated.View
      style={[
        styles.wrap,
        { top: insets.top + 10, borderLeftColor: accent },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
        },
      ]}
    >
      <Pressable onPress={hide} style={styles.inner} accessibilityRole="alert">
        <Text style={styles.icon}>{ICON[kind]}</Text>
        <Text style={styles.text}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      alignSelf: 'center',
      width: '92%',
      maxWidth: 480,
      zIndex: 100,
      backgroundColor: colors.toastBg,
      borderRadius: 12,
      borderLeftWidth: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.25,
      shadowRadius: 16,
      elevation: 8,
    },
    inner: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 },
    icon: { fontSize: 16 },
    text: { color: colors.toastText, fontFamily: fonts.semiBold, fontSize: 14, flex: 1 },
  })
);
