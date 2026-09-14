import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

interface Props {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SelectField({ value, options, onChange, placeholder = 'Select...' }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={styles.field} onPress={() => setOpen(true)}>
        <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <FlatList
              data={options}
              keyExtractor={(item, i) => `${item}-${i}`}
              style={styles.list}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.option, item === value && styles.optionActive]}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.optionText}>{item}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
  placeholder: {
    color: colors.muted,
  },
  chevron: {
    color: colors.muted,
    marginLeft: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(32,30,29,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    maxHeight: '70%',
  },
  list: {
    flexGrow: 0,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  optionActive: {
    backgroundColor: colors.surface,
  },
  optionText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
  },
});
