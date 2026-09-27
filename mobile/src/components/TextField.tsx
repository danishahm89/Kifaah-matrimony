import React, { useRef } from 'react';
import { Animated, StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors, fonts, themedStyles } from '../theme/tokens';

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
    outputRange: [colors.border, colors.primary],
  });

  return (
    <Animated.View style={[styles.input, props.multiline && styles.multiline, { borderColor }]}>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        // Our focus handlers must come after the spread, or the caller's props replace them and
        // the focus highlight never shows.
        style={[styles.inner, props.multiline && styles.multilineInner, props.style]}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </Animated.View>
  );
}

const styles = themedStyles(() => StyleSheet.create({
  input: {
    minHeight: 46,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
  },
  inner: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
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
}));
