import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
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

  const openDetail = (id: string) => navigation.navigate('ProfileDetail', { profileId: id, origin: 'matches' });

  const renderSent = ({ item }: { item: InterestRequest }) => {
    const matched = item.status === 'accepted';
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
        <View style={[styles.chip, matched ? styles.chipMatched : styles.chipAwaiting]}>
          <Text style={[styles.chipText, { color: matched ? colors.lowText : colors.muted }]}>
            {matched ? 'Matched' : 'Awaiting'}
          </Text>
        </View>
      </Pressable>
    );
  };

  const renderReceived = ({ item }: { item: InterestRequest }) => (
    <View style={styles.row}>
      <PlaceholderPhoto width={56} height={56} locked intensity={16} iconSize={14} />
      <View style={styles.rowBody}>
        <Text style={styles.name}>
          {item.name}
          {item.age ? `, ${item.age}` : ''}
        </Text>
        <Text style={styles.meta}>{item.city} · sent you interest</Text>
      </View>
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
        <Button title="Decline" variant="small-outline" onPress={() => decline.mutate({ id: item.id, profileId: item.fromUserId })} />
      </View>
    </View>
  );

  return (
    <Screen edges={['top']}>
      <TabHeader
        title={tabStrings(lang).matches}
        onOpenNotification={(candidateId) => navigation.navigate('ProfileDetail', { profileId: candidateId, origin: 'notification' })}
      />
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
});
