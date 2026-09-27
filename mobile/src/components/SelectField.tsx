import React, { useMemo, useState } from 'react';
import { tr } from '../i18n/t';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, themedStyles } from '../theme/tokens';

interface Props {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Short title shown at the top of the picker sheet. */
  title?: string;
  /** Show a search box (defaults to on for long lists). */
  searchable?: boolean;
}

// Tappable field that opens a clean picker sheet. Long lists get a search box, so for example
// typing "Hyd" suggests Hyderabad straight away.
export function SelectField({ value, options, onChange, placeholder = 'Select...', title, searchable }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const showSearch = searchable ?? options.length > 8;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? options.filter((o) => o.toLowerCase().includes(needle)) : options;
  }, [q, options]);

  const close = () => {
    setOpen(false);
    setQ('');
  };

  return (
    <>
      <Pressable
        style={({ hovered, pressed }: any) => [styles.field, (hovered || pressed || open) && styles.fieldActive, !!value && styles.fieldFilled]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]} numberOfLines={1}>
          {value || tr(placeholder)}
        </Text>
        <Text style={styles.chevron}>{value ? '✓' : '▾'}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{tr(title || 'Select...')}</Text>
              <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>
            {showSearch ? (
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder={tr('Type to search...')}
                placeholderTextColor={colors.muted}
                style={styles.search}
                autoFocus
              />
            ) : null}
            <FlatList
              data={filtered}
              keyExtractor={(item, i) => `${item}-${i}`}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.empty}>{tr('No matches. Try another word.')}</Text>}
              renderItem={({ item }) => {
                const active = item === value;
                return (
                  <Pressable
                    style={({ hovered, pressed }: any) => [
                      styles.option,
                      (hovered || pressed) && styles.optionHover,
                      active && styles.optionActive,
                    ]}
                    onPress={() => {
                      onChange(item);
                      close();
                    }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]}>{tr(item)}</Text>
                    {active ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    field: {
      minHeight: 46,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fieldActive: { borderColor: colors.primary },
    fieldFilled: { backgroundColor: colors.greenBg, borderColor: colors.primary },
    fieldText: { flex: 1, fontFamily: fonts.semiBold, fontSize: 14, color: colors.ink },
    placeholder: { color: colors.muted, fontFamily: fonts.regular },
    chevron: { color: colors.primary, marginLeft: 8, fontSize: 14 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(15,20,15,0.5)',
      justifyContent: 'center',
      padding: 20,
    },
    sheet: {
      backgroundColor: colors.card,
      maxHeight: '75%',
      maxWidth: 460,
      width: '100%',
      alignSelf: 'center',
      borderRadius: 18,
      overflow: 'hidden',
    },
    sheetHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderHairline,
    },
    sheetTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
    close: { fontSize: 18, color: colors.muted },
    search: {
      margin: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      fontFamily: fonts.regular,
      fontSize: 14,
      color: colors.ink,
    },
    list: { flexGrow: 0 },
    empty: { padding: 20, textAlign: 'center', color: colors.muted, fontFamily: fonts.regular },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderHairline,
    },
    optionHover: { backgroundColor: colors.surface },
    optionActive: { backgroundColor: colors.greenBg },
    optionText: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink },
    optionTextActive: { fontFamily: fonts.extraBold, color: colors.greenText },
    check: { color: colors.primary, fontSize: 16, fontFamily: fonts.extraBold },
  })
);
