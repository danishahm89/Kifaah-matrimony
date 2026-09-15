import React, { useRef } from 'react';
import { Animated, StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export function TextField(props: TextInputProps & { multiline?: boolean }) {
  const focusAnim = useRef(new Animated.Value(0)).current;

  const handleFocus: TextInputProps['onFocus'] = (e) => {
    Animated.timing(focusAnim, { toValue: 1, duration: 150, useNativeDriver: false }).start();
    props.onFocus?.(e);
  };

  const handleBlur: TextInputProps['onBlur'] = (e) => {
    Animated.timing(focusAnim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    props.onBlur?.(e);
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.borderStrong, colors.red],
  });

  return (
    <Animated.View style={[styles.input, props.multiline && styles.multiline, { borderColor }]}>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.inner, props.multiline && styles.multilineInner, props.style]}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 40,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  multiline: {
    minHeight: 96,
  },
  multilineInner: {
    textAlignVertical: 'top',
    paddingTop: 10,
  },
});
