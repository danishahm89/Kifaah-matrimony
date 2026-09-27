import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { tr } from '../i18n/t';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { Button } from './Button';

interface Props {
  percent: number;
  missing: string[];
  onEdit: () => void;
}

// Profile tab card: how complete the profile is, what to add next, and the Edit button.
export function ProfileCompletion({ percent, missing, onEdit }: Props) {
  const complete = percent >= 100;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{tr(complete ? 'Your profile is complete' : 'Complete your profile')}</Text>
        <Text style={styles.pct}>{percent}%</Text>
      </View>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }}>
        <View style={[styles.fill, { width: `${Math.max(4, percent)}%` }]} />
      </View>
      {!complete ? (
        <Text style={styles.hint}>
          {tr('Complete profiles get more replies. Add:')} {missing.slice(0, 3).map((m) => tr(m)).join(', ')}
        </Text>
      ) : null}
      <Button title="Edit profile" variant={complete ? 'outline' : 'primary'} onPress={onEdit} />
    </View>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    card: { padding: 16, gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.ink },
    pct: { fontFamily: fonts.extraBold, fontSize: 18, color: colors.primary },
    track: { height: 8, borderRadius: 4, backgroundColor: colors.borderSoft, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 4, backgroundColor: colors.primary },
    hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 19 },
  })
);
