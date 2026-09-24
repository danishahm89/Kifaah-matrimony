import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Screen } from '../components/Screen';
import { TabHeader } from '../components/TabHeader';
import { SegmentRow } from '../components/SegmentRow';
import { PlaceholderPhoto } from '../components/PlaceholderPhoto';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { colors, fonts } from '../theme/tokens';
import { useSentInterests, useReceivedInterests, useAcceptInterest, useDeclineInterest } from '../api/hooks/useInterests';
import { useBlockUser } from '../api/hooks/useBlocks';
import { useMe } from '../api/hooks/useAuth';
import { useAuthStore } from '../store/authStore';
import { tabStrings } from '../i18n/strings';
import { useToastStore } from '../store/uiStore';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import type { InterestRequest } from '../types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Matches'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function MatchesScreen() {
  const navigation = useNavigation<Nav>();
  const lang = useAuthStore((s) => s.user?.language ?? 'en');
  const [tab, setTab] = useState<'sent' | 'received'>('sent');
  const showToast = useToastStore((s) => s.show);

  const { data: me } = useMe(true);
  const subscribed = me?.subscription?.status === 'active';

  const sentQuery = useSentInterests();
  const receivedQuery = useReceivedInterests();
  const accept = useAcceptInterest();
  const decline = useDeclineInterest();
  const blockUser = useBlockUser();

  const openDetail = (id: string) => navigation.navigate('ProfileDetail', { profileId: id, origin: 'matches' });

  // Anywhere a connected user's identity is shown, a Block action must be reachable (CONTRACT.md
  // §8.3 / task brief item 2) — a confirmation dialog first, then the block itself.
  const confirmBlock = (userId: string, name?: string) => {
    Alert.alert('Block this user?', 'Are you sure you want to block this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          blockUser.mutate(userId, {
            onSuccess: () => showToast(name ? `${name} has been blocked.` : 'User blocked.'),
            onError: () => showToast('Could not block this user. Please try again.'),
          }),
      },
    ]);
  };

  // `status` chip for either tab: only `accepted` counts as "Matched" — a bug fix target
  // (task brief item 1) is that a `declined` row must never render as anything actionable/matched.
  function statusChip(status: InterestRequest['status']) {
    if (status === 'accepted') return { label: 'Matched', bg: styles.chipMatched, color: colors.lowText };
    if (status === 'declined') return { label: 'Declined', bg: styles.chipAwaiting, color: colors.muted };
    return { label: 'Awaiting', bg: styles.chipAwaiting, color: colors.muted };
  }

  const renderSent = ({ item }: { item: InterestRequest }) => {
    const matched = item.status === 'accepted';
    const chip = statusChip(item.status);
    return (
      <Pressable style={styles.row} onPress={() => openDetail(item.toUserId)}>
        <PlaceholderPhoto width={56} height={56} locked={!(matched && subscribed)} intensity={16} iconSize={14} />
        <View style={styles.rowBody}>
          <Text style={styles.name}>
            {item.name}
            {item.age ? `, ${item.age}` : ''}
          </Text>
          <Text style={styles.meta}>{item.city}</Text>
        </View>
        <View style={styles.rowEnd}>
          <View style={[styles.chip, chip.bg]}>
            <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
          </View>
          {matched ? (
            <Button title="Block" variant="text" onPress={() => confirmBlock(item.toUserId, item.name)} />
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderReceived = ({ item }: { item: InterestRequest }) => {
    const isPending = item.status === 'pending';
    const chip = statusChip(item.status);
    return (
      <View style={styles.row}>
        <PlaceholderPhoto width={56} height={56} locked intensity={16} iconSize={14} />
        <View style={styles.rowBody}>
          <Text style={styles.name}>
            {item.name}
            {item.age ? `, ${item.age}` : ''}
          </Text>
          <Text style={styles.meta}>{item.city} · sent you interest</Text>
        </View>
        {isPending ? (
          // Fix for task brief item 2: Accept/Decline only ever render for a still-`pending`
          // request — never on an already-`accepted`/`declined` row, regardless of what the
          // backend's GET /api/interests/received returns (it's expected to start filtering to
          // pending-only per CONTRACT.md §8, but this client-side guard is the real fix and holds
          // either way).
          <View style={styles.actions}>
            <Button
              title="Accept"
              variant="small-primary"
              onPress={() =>
                accept.mutate(
                  { id: item.id, profileId: item.fromUserId },
                  {
                    onSuccess: () =>
                      showToast(
                        subscribed
                          ? `It's a match! You can now message ${item.name}`
                          : `Interest accepted — subscribe to unlock chat with ${item.name}`
                      ),
                  }
                )
              }
            />
            <Button
              title="Decline"
              variant="small-outline"
              onPress={() => decline.mutate({ id: item.id, profileId: item.fromUserId })}
            />
          </View>
        ) : (
          <View style={styles.rowEnd}>
            <View style={[styles.chip, chip.bg]}>
              <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
            </View>
            {item.status === 'accepted' ? (
              <Button title="Block" variant="text" onPress={() => confirmBlock(item.fromUserId, item.name)} />
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen edges={['top']}>
      <TabHeader title={tabStrings(lang).matches} />
      <View style={styles.tabsRow}>
        <SegmentRow
          wrap={false}
          options={[
            { label: 'Sent', value: 'sent' },
            { label: 'Received', value: 'received' },
          ]}
          value={tab}
          onChange={(v) => setTab(v as 'sent' | 'received')}
        />
      </View>

      {tab === 'sent' ? (
        <FlatList
          data={sentQuery.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderSent}
          refreshing={sentQuery.isRefetching}
          onRefresh={sentQuery.refetch}
          ListEmptyComponent={
            !sentQuery.isLoading ? (
              <EmptyState text="You haven't sent any interest yet. Browse Discover to find a match." />
            ) : null
          }
        />
      ) : (
        <FlatList
          data={receivedQuery.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={renderReceived}
          refreshing={receivedQuery.isRefetching}
          onRefresh={receivedQuery.refetch}
          ListEmptyComponent={!receivedQuery.isLoading ? <EmptyState text="No incoming interest right now." /> : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabsRow: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
    alignItems: 'center',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.ink,
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  chip: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  chipMatched: {
    backgroundColor: colors.lowBg,
  },
  chipAwaiting: {
    backgroundColor: colors.surface,
  },
  chipText: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  rowEnd: {
    alignItems: 'flex-end',
    gap: 6,
  },
});
