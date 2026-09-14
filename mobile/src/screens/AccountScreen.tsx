import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Screen } from '../components/Screen';
import { TabHeader } from '../components/TabHeader';
import { Button } from '../components/Button';
import { colors, fonts } from '../theme/tokens';
import { useProfileMe } from '../api/hooks/useProfile';
import { useLogout, useMe } from '../api/hooks/useAuth';
import { useRunMatchEngine } from '../api/hooks/useMatchEngine';
import { useAuthStore } from '../store/authStore';
import { tabStrings } from '../i18n/strings';
import { useToastStore } from '../store/uiStore';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import type { Profile } from '../types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Account'>,
  NativeStackNavigationProp<RootStackParamList>
>;

const OTHER_SPECIFY = 'Other (specify)';

function resolveOther(profile: Profile | undefined, field: 'diet' | 'habits' | 'likes' | 'dislikes') {
  if (!profile) return '—';
  const value = profile[field];
  const custom = profile[`${field}Custom` as const];
  const resolved = value === OTHER_SPECIFY ? custom : value;
  return resolved || '—';
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function AccountScreen() {
  const navigation = useNavigation<Nav>();
  const lang = useAuthStore((s) => s.user?.language ?? 'en');
  const gender = useAuthStore((s) => s.user?.gender ?? 'bride');
  const logout = useLogout();
  const showToast = useToastStore((s) => s.show);

  const { data: profile } = useProfileMe();
  const { data: me } = useMe(true);
  const runEngine = useRunMatchEngine();

  const subscribed = me?.subscription?.status === 'active';
  const modestyQuestion = gender === 'bride' ? 'Hijab' : 'Beard';
  const polygamyQuestion = gender === 'groom' ? 'View on polygamy' : 'View on being a co-wife';

  const myName =
    profile?.name || (profile?.city || profile?.eduProf ? `You, ${gender === 'bride' ? 'Sister' : 'Brother'}` : 'Your profile');
  const planStatusLabel = subscribed
    ? `${me?.subscription?.tier === 'premium' ? 'Premium' : 'Basic'} · ${me?.subscription?.billing === 'annual' ? 'Annual' : 'Monthly'}`
    : 'No active plan';

  return (
    <Screen edges={['top']}>
      <TabHeader
        title={tabStrings(lang).account}
        onOpenNotification={(candidateId) => navigation.navigate('ProfileDetail', { profileId: candidateId, origin: 'notification' })}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{myName}</Text>
          <Text style={styles.cardSub}>
            {profile?.city || '—'} · {profile?.eduProf || '—'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: subscribed ? colors.lowBg : colors.surface }]}>
          <Text style={styles.eyebrow}>Subscription</Text>
          <Text style={styles.planStatus}>{planStatusLabel}</Text>
          <Button
            title={subscribed ? 'Manage plan' : 'Subscribe now'}
            variant="text"
            onPress={() => navigation.navigate('Pricing', { returnTo: 'account' })}
            style={styles.planCta}
          />
        </View>

        <View>
          <Text style={styles.sectionLabel}>Shariah preferences</Text>
          <View style={styles.summaryList}>
            <Row label="Sect" value={profile?.sect || '—'} />
            <Row label="Prayer" value={profile?.prayer || '—'} />
            <Row label={modestyQuestion} value={profile?.modesty || '—'} />
            <Row label="Fasting" value={profile?.fasting || '—'} />
            <Row label="Qur'an" value={profile?.quran || '—'} />
            <Row label="Hajj / Umrah" value={profile?.hajj || '—'} />
            <Row label={polygamyQuestion} value={profile?.polygamy || '—'} />
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Wali</Text>
              <Text style={styles.summaryValue}>{profile?.wali || '—'}</Text>
            </View>
          </View>
        </View>

        <View>
          <Text style={styles.sectionLabel}>Lifestyle</Text>
          <View style={styles.summaryList}>
            <Row label="Diet" value={resolveOther(profile, 'diet')} />
            <Row label="Smoking" value={profile?.smoking || '—'} />
            <Row label="Habits" value={resolveOther(profile, 'habits')} />
            <Row label="Likes" value={resolveOther(profile, 'likes')} />
            <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.summaryLabel}>Dislikes</Text>
              <Text style={styles.summaryValue}>{resolveOther(profile, 'dislikes')}</Text>
            </View>
          </View>
        </View>

        <Button title="Frequently asked questions" variant="outline" onPress={() => navigation.navigate('FAQ')} />

        <View style={styles.engineBox}>
          <Text style={styles.eyebrow}>Match engine</Text>
          <Text style={styles.engineBody}>
            Runs automatically once a week, scoring on location, sect, profession and religious practice.
            Already-matched, rejected or pending profiles are never repeated.
          </Text>
          <Button
            title="Run this week's refresh now (demo)"
            variant="outline"
            style={styles.engineBtn}
            loading={runEngine.isPending}
            onPress={() =>
              runEngine.mutate(undefined, {
                onSuccess: (data) => {
                  if (data.notifications.length > 0) {
                    showToast(`New match found (${data.notifications[0].score}% match)`);
                  }
                },
              })
            }
          />
        </View>

        <Button
          title="Log out"
          variant="outline"
          onPress={() => logout.mutate()}
          loading={logout.isPending}
          style={styles.logoutBtn}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  card: {
    padding: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.ink,
  },
  cardSub: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    fontFamily: fonts.regular,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  planStatus: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    marginTop: 4,
    color: colors.ink,
  },
  planCta: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
    fontFamily: fonts.regular,
  },
  summaryList: {
    gap: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
    paddingBottom: 6,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  summaryValue: {
    fontSize: 13,
    color: colors.ink,
    fontFamily: fonts.regular,
    flexShrink: 1,
    textAlign: 'right',
  },
  engineBox: {
    padding: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  engineBody: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 10,
    fontFamily: fonts.regular,
  },
  engineBtn: {
    paddingVertical: 10,
  },
  logoutBtn: {
    marginTop: 8,
  },
});
