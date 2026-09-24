import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { FieldLabel } from '../components/FieldLabel';
import { SelectField } from '../components/SelectField';
import { SegmentRow } from '../components/SegmentRow';
import { ShieldIcon } from '../icons';
import { colors, fonts } from '../theme/tokens';
import { useReference } from '../api/hooks/useReference';
import { useAuthStore } from '../store/authStore';
import { useOnboardingStore } from '../store/onboardingStore';
import type { RootStackParamList } from '../navigation/types';

export function ShariahQAScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gender = useAuthStore((s) => s.user?.gender ?? 'bride');
  const { data: ref, isLoading } = useReference();
  const { draft, setField } = useOnboardingStore();
  const [waliError, setWaliError] = useState<string | null>(null);

  const modestyQuestion = gender === 'bride' ? 'Hijab' : 'Beard';
  const polygamyQuestion = gender === 'groom' ? 'View on polygamy' : 'View on being a co-wife';

  if (isLoading || !ref) {
    return (
      <Screen>
        <Header title="Shariah compliance" onBack={() => navigation.navigate('Welcome')} />
        <View style={styles.loading}>
          <ActivityIndicator color={colors.red} />
        </View>
      </Screen>
    );
  }

  const asOptions = (list: string[]) => list.map((v) => ({ label: v, value: v }));

  return (
    <Screen>
      <Header title="Shariah compliance" onBack={() => navigation.navigate('Welcome')} />
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>A few questions so matches are compatible in practice, not just on paper.</Text>

        <View>
          <FieldLabel>Sect / Madhab</FieldLabel>
          <SelectField value={draft.sect ?? ''} options={ref.sects} onChange={(v) => setField('sect', v)} />
        </View>

        <View>
          <FieldLabel>Prayer (Salah) regularity</FieldLabel>
          <SegmentRow options={asOptions(ref.prayerOptions)} value={draft.prayer ?? ''} onChange={(v) => setField('prayer', v)} wrap={false} />
        </View>

        <View>
          <FieldLabel>{modestyQuestion}</FieldLabel>
          <SegmentRow
            options={asOptions(gender === 'bride' ? ref.modestyOptions.bride : ref.modestyOptions.groom)}
            value={draft.modesty ?? ''}
            onChange={(v) => setField('modesty', v)}
          />
        </View>

        <View style={styles.noticeBox}>
          <ShieldIcon />
          <Text style={styles.noticeText}>
            A wali (guardian) is required to be involved before contact is exchanged. This is fixed, not optional.
          </Text>
        </View>
        <View>
          <FieldLabel>Wali / guardian's name</FieldLabel>
          <TextField
            value={draft.wali ?? ''}
            onChangeText={(v) => {
              setField('wali', v);
              if (waliError) setWaliError(null);
            }}
            placeholder="e.g. Father — Abdul Kareem"
          />
          {waliError ? <Text style={styles.error}>{waliError}</Text> : null}
        </View>

        <View>
          <FieldLabel>Fasting (Ramadan & voluntary)</FieldLabel>
          <SegmentRow options={asOptions(ref.fastingOptions)} value={draft.fasting ?? ''} onChange={(v) => setField('fasting', v)} />
        </View>

        <View>
          <FieldLabel>Qur'an recitation</FieldLabel>
          <SegmentRow options={asOptions(ref.quranOptions)} value={draft.quran ?? ''} onChange={(v) => setField('quran', v)} />
        </View>

        <View>
          <FieldLabel>Hajj / Umrah</FieldLabel>
          <SegmentRow options={asOptions(ref.hajjOptions)} value={draft.hajj ?? ''} onChange={(v) => setField('hajj', v)} />
        </View>

        <View>
          <FieldLabel>{polygamyQuestion}</FieldLabel>
          <SegmentRow
            options={asOptions(gender === 'groom' ? ref.polygamyOptions.groom : ref.polygamyOptions.bride)}
            value={draft.polygamy ?? ''}
            onChange={(v) => setField('polygamy', v)}
          />
        </View>

          <Button
            title="Continue"
            onPress={() => {
              // A wali is fixed, not optional (per the notice above), and the backend
              // rejects an explicit blank with a bare "invalid_input" — catch it here
              // with a message that says what to do, instead of letting that reach the user.
              if (!draft.wali || !draft.wali.trim()) {
                setWaliError("Please add your wali's (guardian's) name to continue.");
                return;
              }
              navigation.navigate('ProfileSetup');
            }}
            style={styles.continueBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  error: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.redDark,
    marginTop: 6,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    padding: 20,
    paddingBottom: 32,
    gap: 18,
  },
  intro: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 20,
  },
  noticeBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
  },
  continueBtn: {
    marginTop: 8,
  },
});
