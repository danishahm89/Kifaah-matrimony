import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Screen } from '../components/Screen';
import { TabHeader } from '../components/TabHeader';
import { PlaceholderPhoto } from '../components/PlaceholderPhoto';
import { MatchChip } from '../components/MatchChip';
import { EmptyState } from '../components/EmptyState';
import { colors, fonts } from '../theme/tokens';
import { useDiscover } from '../api/hooks/useDiscover';
import { useAuthStore } from '../store/authStore';
import { tabStrings } from '../i18n/strings';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import type { DiscoverCandidate } from '../types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Discover'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const gender = useAuthStore((s) => s.user?.gender ?? 'bride');
  const lang = useAuthStore((s) => s.user?.language ?? 'en');
  const { data: candidates = [], isLoading, refetch, isRefetching } = useDiscover();

  const feedGenderLabel = gender === 'groom' ? 'sisters' : 'brothers';

  const openDetail = (id: string) => navigation.navigate('ProfileDetail', { profileId: id, origin: 'discover' });

  const renderItem = ({ item }: { item: DiscoverCandidate }) => (
    <Pressable style={styles.row} onPress={() => openDetail(item.id)}>
      <PlaceholderPhoto width={72} height={72} locked intensity={16} iconSize={18} />
      <View style={styles.rowBody}>
        <Text style={styles.name}>
          {item.name}, {item.age}
        </Text>
        <Text style={styles.meta}>
          {item.city} · {item.sect}
        </Text>
        <Text style={styles.meta}>{item.eduProf}</Text>
        <View style={styles.chipWrap}>
          <MatchChip score={item.score} />
        </View>
      </View>
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <TabHeader title={tabStrings(lang).discover} />
      <Text style={styles.subtitle}>
        Showing {feedGenderLabel} near you, ranked by compatibility · photos and contact stay private until a mutual
        interest is accepted
      </Text>
      <FlatList
        data={candidates}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={isRefetching && !isLoading}
        onRefresh={refetch}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState text="You've reviewed everyone matching your preferences right now. New recommendations arrive with the weekly match refresh." />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
    fontSize: 12,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
  row: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.ink,
  },
  meta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
    fontFamily: fonts.regular,
  },
  chipWrap: {
    marginTop: 8,
  },
});
