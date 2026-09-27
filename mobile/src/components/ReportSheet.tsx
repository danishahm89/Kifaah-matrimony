import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { tr } from '../i18n/t';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { SegmentRow } from './SegmentRow';
import { TextField } from './TextField';
import { Button } from './Button';
import type { ReportReason } from '../api/client';

const REASONS: { label: string; value: ReportReason }[] = [
  { label: 'Fake profile', value: 'fake_profile' },
  { label: 'Already married', value: 'already_married' },
  { label: 'Inappropriate photo', value: 'inappropriate_photo' },
  { label: 'Harassment or rude messages', value: 'harassment' },
  { label: 'Asking for money', value: 'asking_money' },
  { label: 'Something else', value: 'other' },
];

interface Props {
  visible: boolean;
  name: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (v: { reason: ReportReason; details?: string; block: boolean }) => void;
}

// Bottom sheet for reporting a member. Reason is required; details are optional.
// "Also block" is on by default so the member disappears from the reporter's app.
export function ReportSheet({ visible, name, loading, onClose, onSubmit }: Props) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(true);

  const submit = () => {
    if (!reason) return;
    onSubmit({ reason, details: details.trim() || undefined, block });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={tr('Close')} />
      <View style={styles.sheet}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{tr('Report')} {name}</Text>
          <Text style={styles.sub}>
            {tr('Our team reviews every report. The member is not told who reported them.')}
          </Text>

          <Text style={styles.label}>{tr('What is the problem?')}</Text>
          <SegmentRow options={REASONS} value={reason} onChange={(v) => setReason(v as ReportReason)} />

          <Text style={styles.label}>{tr('More details (optional)')}</Text>
          <TextField
            value={details}
            onChangeText={setDetails}
            placeholder={tr('Tell us what happened')}
            multiline
            maxLength={1000}
          />

          <View style={styles.blockRow}>
            <Text style={styles.blockText}>{tr('Also block this member')}</Text>
            <Switch value={block} onValueChange={setBlock} trackColor={{ true: colors.primary, false: colors.border }} />
          </View>

          <View style={styles.actions}>
            <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title="Send report" onPress={submit} disabled={!reason} loading={loading} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
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
    sub: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 19 },
    label: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.ink, marginTop: 8 },
    blockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    blockText: { fontFamily: fonts.semiBold, fontSize: 14, color: colors.ink },
    actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  })
);
