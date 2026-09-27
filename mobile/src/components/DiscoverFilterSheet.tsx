import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { tr } from '../i18n/t';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { SegmentRow } from './SegmentRow';
import { SelectField } from './SelectField';
import { FieldLabel } from './FieldLabel';
import { Button } from './Button';
import type { DiscoverFilters } from '../types';

const ANY = 'Any';

export const AGE_RANGES: { label: string; value: string; min?: number; max?: number }[] = [
  { label: 'Any', value: 'any' },
  { label: '18–24', value: '18-24', min: 18, max: 24 },
  { label: '25–29', value: '25-29', min: 25, max: 29 },
  { label: '30–34', value: '30-34', min: 30, max: 34 },
  { label: '35–39', value: '35-39', min: 35, max: 39 },
  { label: '40+', value: '40+', min: 40, max: 99 },
];

function ageValue(f: DiscoverFilters) {
  return AGE_RANGES.find((r) => r.min === f.minAge && r.max === f.maxAge)?.value ?? 'any';
}

interface Props {
  visible: boolean;
  value: DiscoverFilters;
  cities: string[];
  states?: string[];
  sects: string[];
  maritalOptions: string[];
  onClose: () => void;
  onApply: (f: DiscoverFilters) => void;
}

// Bottom sheet with the Discover filters. Changes apply only on "Show results".
export function DiscoverFilterSheet({ visible, value, cities, states, sects, maritalOptions, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<DiscoverFilters>(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const setAge = (v: string) => {
    const r = AGE_RANGES.find((x) => x.value === v);
    setDraft((d) => ({ ...d, minAge: r?.min, maxAge: r?.max }));
  };
  const pick = (key: 'city' | 'state' | 'sect' | 'marital') => (v: string) =>
    setDraft((d) => ({ ...d, [key]: v === ANY ? undefined : v }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={tr('Close')} />
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{tr('Filters')}</Text>

          <FieldLabel>{tr('Age')}</FieldLabel>
          <SegmentRow options={AGE_RANGES} value={ageValue(draft)} onChange={setAge} />

          {states && states.length > 0 ? (
            <>
              <FieldLabel>{tr('State')}</FieldLabel>
              <SelectField title="State" searchable value={draft.state ?? ANY} options={[ANY, ...states]} onChange={pick('state')} />
            </>
          ) : null}

          <FieldLabel>{tr('City')}</FieldLabel>
          <SelectField title="City" searchable value={draft.city ?? ANY} options={[ANY, ...cities]} onChange={pick('city')} />

          <FieldLabel>{tr('Sect / Madhab')}</FieldLabel>
          <SelectField title="Sect / Madhab" value={draft.sect ?? ANY} options={[ANY, ...sects]} onChange={pick('sect')} />

          <FieldLabel>{tr('Marital status')}</FieldLabel>
          <SegmentRow
            options={[ANY, ...maritalOptions].map((m) => ({ label: m, value: m }))}
            value={draft.marital ?? ANY}
            onChange={pick('marital')}
          />

          <View style={styles.actions}>
            <Button title="Clear all" variant="outline" onPress={() => setDraft({})} style={{ flex: 1 }} />
            <Button title="Show results" onPress={() => onApply(draft)} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function activeFilterCount(f: DiscoverFilters) {
  return (f.minAge != null || f.maxAge != null ? 1 : 0) + (f.city ? 1 : 0) + (f.state ? 1 : 0) + (f.sect ? 1 : 0) + (f.marital ? 1 : 0);
}

const styles = themedStyles(() =>
  StyleSheet.create({
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' },
    sheet: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: '88%',
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      alignSelf: 'center',
      width: '100%',
      maxWidth: 560,
    },
    body: { padding: 20, gap: 10 },
    title: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.ink },
    actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  })
);
