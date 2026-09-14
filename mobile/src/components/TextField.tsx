import React from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export function TextField(props: TextInputProps & { multiline?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={[styles.input, props.multiline && styles.multiline, props.style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
});
