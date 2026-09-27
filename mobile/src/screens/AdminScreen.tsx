import React, { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { Button } from '../components/Button';
import { SegmentRow } from '../components/SegmentRow';
import { EmptyState } from '../components/EmptyState';
import { Alert } from '../utils/alert';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { useAdminContactAttempts, useAdminReports, useSetReportStatus, useSuspendUser } from '../api/hooks/useAdmin';
import { useToastStore } from '../store/uiStore';
import type { AdminReport } from '../api/client';
import type { RootStackParamList } from '../navigation/types';

// Real admin area (replaces the old mock screen). Only admins can load data;
// the server refuses everyone else.

const REASON_LABEL: Record<string, string> = {
  fake_profile: 'Fake profile',
  already_married: 'Already married',
  inappropriate_photo: 'Inappropriate photo',
  harassment: 'Harassment',
  asking_money: 'Asking for money',
  other: 'Other',
};

type Tab = 'open' | 'all' | 'contact';

function when(iso: string) {
  return new Date(iso).toLocaleString();
}

export function AdminScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<Tab>('open');
  const reports = useAdminReports(tab === 'all' ? 'all' : 'open');
  const attempts = useAdminContactAttempts();
  const setStatus = useSetReportStatus();
  const suspend = useSuspendUser();
  const showToast = useToastStore((s) => s.show);

  const confirmSuspend = (userId: string, name: string, next: boolean) => {
    Alert.alert(
      next ? `Suspend ${name}?` : `Restore ${name}?`,
      next
        ? 'They will be logged out, hidden from everyone, and cannot use the app until restored.'
        : 'They will be able to log in and appear to others again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: next ? 'Suspend' : 'Restore',
          style: next ? 'destructive' : 'default',
          onPress: () =>
            suspend.mutate(
              { userId, suspended: next },
              {
                onSuccess: () => showToast(next ? `${name} suspended.` : `${name} restored.`, 'success'),
                onError: () => showToast('Could not update this member. Please try again.'),
              }
            ),
        },
      ]
    );
  };

  const mark = (r: AdminReport, status: AdminReport['status']) =>
    setStatus.mutate({ id: r.id, status }, { onError: () => showToast('Could not update the report.') });

  const forbidden = (reports.error as any)?.status === 403 || (attempts.error as any)?.status === 403;

  const renderReport = ({ item: r }: { item: AdminReport }) => (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.reason}>{REASON_LABEL[r.reason] ?? r.reason}</Text>
        <Text style={[styles.status, r.status === 'open' && { color: colors.red }]}>{r.status}</Text>
      </View>
      <Text style={styles.line}>
        <Text style={styles.bold}>{r.reported.name}</Text>
        {r.reported.city ? ` · ${r.reported.city}` : ''} — reported {r.reported.totalReports} time
        {r.reported.totalReports === 1 ? '' : 's'}
        {r.reported.suspended ? ' · SUSPENDED' : ''}
        {r.reported.deleted ? ' · account deleted' : ''}
      </Text>
      <Text style={styles.small}>
        By {r.reporter.name} · {when(r.createdAt)}
      </Text>
      {r.details ? <Text style={styles.details}>“{r.details}”</Text> : null}
      <View style={styles.actions}>
        {!r.reported.deleted ? (
          <Button
            title="Open profile"
            variant="small-outline"
            onPress={() => navigation.navigate('ProfileDetail', { profileId: r.reported.id, origin: 'notification' })}
          />
        ) : null}
        {r.status === 'open' ? <Button title="Reviewed" variant="small-outline" onPress={() => mark(r, 'reviewed')} /> : null}
        {r.status === 'open' ? <Button title="Dismiss" variant="small-outline" onPress={() => mark(r, 'dismissed')} /> : null}
        {!r.reported.deleted ? (
          <Button
            title={r.reported.suspended ? 'Restore member' : 'Suspend member'}
            variant="small-primary"
            onPress={() => confirmSuspend(r.reported.id, r.reported.name, !r.reported.suspended)}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen>
      <Header title="Admin" onBack={() => navigation.goBack()} />
      <View style={styles.tabs}>
        <SegmentRow
          options={[
            { label: 'Open reports', value: 'open' },
            { label: 'All reports', value: 'all' },
            { label: 'Contact-sharing attempts', value: 'contact' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </View>

      {forbidden ? (
        <EmptyState text="This area is only for Kifaah admins." />
      ) : tab === 'contact' ? (
        <FlatList
          data={attempts.data ?? []}
          keyExtractor={(i) => i.userId}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text style={styles.small}>Members whose messages or profile text were blocked for contact details (last 30 days).</Text>
          }
          ListEmptyComponent={attempts.isLoading ? <ActivityIndicator color={colors.primary} /> : <EmptyState text="No attempts. 👍" />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.line}>
                <Text style={styles.bold}>{item.name}</Text>
                {item.city ? ` · ${item.city}` : ''}
                {item.suspended ? ' · SUSPENDED' : ''}
              </Text>
              <Text style={styles.small}>
                {item.attempts} blocked attempt{item.attempts === 1 ? '' : 's'} · last {when(item.lastAttemptAt)}
              </Text>
              <View style={styles.actions}>
                <Button
                  title="Open profile"
                  variant="small-outline"
                  onPress={() => navigation.navigate('ProfileDetail', { profileId: item.userId, origin: 'notification' })}
                />
                <Button
                  title={item.suspended ? 'Restore member' : 'Suspend member'}
                  variant="small-primary"
                  onPress={() => confirmSuspend(item.userId, item.name, !item.suspended)}
                />
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={reports.data ?? []}
          keyExtractor={(r) => r.id}
          renderItem={renderReport}
          contentContainerStyle={styles.list}
          refreshing={reports.isRefetching}
          onRefresh={reports.refetch}
          ListEmptyComponent={
            reports.isLoading ? <ActivityIndicator color={colors.primary} /> : <EmptyState text="No reports here. 👍" />
          }
        />
      )}
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    tabs: { paddingHorizontal: 16, paddingTop: 12 },
    list: { padding: 16, gap: 12 },
    card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 6 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reason: { fontFamily: fonts.extraBold, fontSize: 15, color: colors.ink },
    status: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.muted, textTransform: 'uppercase' },
    line: { fontFamily: fonts.regular, fontSize: 14, color: colors.ink },
    bold: { fontFamily: fonts.semiBold },
    small: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    details: { fontFamily: fonts.regular, fontSize: 13, color: colors.ink, fontStyle: 'italic' },
    actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  })
);
