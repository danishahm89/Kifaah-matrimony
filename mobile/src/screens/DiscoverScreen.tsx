import React, { useMemo, useState } from 'react';
import { GenderAvatar } from '../components/GenderAvatar';
import { tr } from '../i18n/t';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Screen } from '../components/Screen';
import { TabHeader } from '../components/TabHeader';
import { EmptyState } from '../components/EmptyState';
import { colors, fonts, themedStyles } from '../theme/tokens';
import { useDiscoverFeed } from '../api/hooks/useDiscover';
import { useReference } from '../api/hooks/useReference';
import { DiscoverFilterSheet, activeFilterCount } from '../components/DiscoverFilterSheet';
import { useAuthStore } from '../store/authStore';
import { tabStrings } from '../i18n/strings';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import type { DiscoverCandidate, DiscoverFilters } from '../types';

const REASON_LABELS: Record<string, string> = {
  fits_preferences: 'Fits your preferences',
  same_city: 'Same city',
  same_sect: 'Same sect',
  same_prayer: 'Same prayer habit',
  similar_profession: 'Similar profession',
};

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Discover'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function ProfileCard({ item, onOpen, theirGender }: { item: DiscoverCandidate; onOpen: () => void; theirGender: 'bride' | 'groom' }) {
  const good = item.score >= 65;
  return (
    <Pressable
      onPress={onOpen}
      style={({ pressed, hovered }: any) => [styles.card, (pressed || hovered) && styles.cardActive]}
      accessibilityRole="button"
      accessibilityLabel={tr('View profile of {name}', { name: item.name })}
    >
      <View style={styles.cardTop}>
        <GenderAvatar gender={theirGender} size={64} photoUrl={item.photoUrl} locked={!item.photoUrl} />
        <View style={styles.cardInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.ageLine}>
            {item.age}{" "}{tr("yrs")}{item.city ? ` · ${item.city}` : ''}
          </Text>
        </View>
        <View style={[styles.scorePill, { backgroundColor: good ? colors.greenBg : colors.lowBg }]}>
          <Text style={[styles.scoreNum, { color: good ? colors.greenText : colors.lowText }]}>{item.score}%</Text>
          <Text style={[styles.scoreLabel, { color: good ? colors.greenText : colors.lowText }]}>{tr("match")}</Text>
        </View>
      </View>

      <View style={styles.facts}>
        {item.sect ? (
          <View style={styles.fact}>
            <Text style={styles.factText}>🕌 {item.sect}</Text>
          </View>
        ) : null}
        {item.eduProf ? (
          <View style={styles.fact}>
            <Text style={styles.factText} numberOfLines={1}>
              🎓 {item.eduProf}
            </Text>
          </View>
        ) : null}
      </View>

      {item.reasons && item.reasons.length > 0 ? (
        <View style={styles.reasons} accessibilityLabel={tr('Why this match')}>
          <Text style={styles.reasonsLabel}>{tr('Why this match')}</Text>
          <View style={styles.facts}>
            {item.reasons.map((r) => (
              <View key={r} style={styles.reasonChip}>
                <Text style={styles.reasonText}>✓ {tr(REASON_LABELS[r] ?? r)}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.privacyNote}>{tr("Photo private until approved")}</Text>
        <Text style={styles.viewLink}>{tr("View profile ›")}</Text>
      </View>
    </Pressable>
  );
}

export function DiscoverScreen() {
  const navigation = useNavigation<Nav>();
  const gender = useAuthStore((s) => s.user?.gender ?? 'bride');
  const lang = useAuthStore((s) => s.user?.language ?? 'en');
  const { width } = useWindowDimensions();
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const { data: ref } = useReference();
  const feed = useDiscoverFeed(filters);
  const { isLoading, refetch, isRefetching } = feed;
  const candidates = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const total = feed.data?.pages[0]?.total ?? 0;
  const filterCount = activeFilterCount(filters);

  const feedGenderLabel = gender === 'groom' ? 'sisters' : 'brothers';
  const columns = Platform.OS === 'web' && width >= 1100 ? 2 : 1;

  const openDetail = (id: string) => navigation.navigate('ProfileDetail', { profileId: id, origin: 'discover' });

  return (
    <Screen edges={['top']} maxContentWidth={columns === 2 ? 960 : 700}>
      <TabHeader title={tabStrings(lang).discover} />
      <FlatList
        key={`cols-${columns}`}
        data={candidates}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        columnWrapperStyle={columns > 1 ? styles.columnWrap : undefined}
        ListHeaderComponent={
          <View style={styles.intro}>
            <Text style={styles.introTitle}>
              {total > 0
                ? tr(`{n} suggested ${feedGenderLabel}`, { n: total })
                : tr(`Suggested ${feedGenderLabel}`)}
            </Text>
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setFilterOpen(true)}
                style={({ hovered }: any) => [styles.filterBtn, filterCount > 0 && styles.filterBtnOn, hovered && styles.cardActive]}
                accessibilityRole="button"
              >
                <Text style={[styles.filterBtnText, filterCount > 0 && { color: colors.white }]}>
                  ⚙︎ {tr('Filters')}{filterCount > 0 ? ` (${filterCount})` : ''}
                </Text>
              </Pressable>
              {filterCount > 0 ? (
                <Pressable onPress={() => setFilters({})} accessibilityRole="button">
                  <Text style={styles.clearText}>{tr('Clear')}</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.introText}>
              {tr("Ranked by compatibility. Photos and contact details stay private until you both agree.")}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={columns > 1 ? styles.half : undefined}>
            <ProfileCard item={item} theirGender={gender === 'groom' ? 'bride' : 'groom'} onOpen={() => openDetail(item.id)} />
          </View>
        )}
        refreshing={isRefetching && !isLoading && !feed.isFetchingNextPage}
        onRefresh={refetch}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
        }}
        ListFooterComponent={
          feed.hasNextPage ? (
            <Pressable onPress={() => feed.fetchNextPage()} style={styles.moreBtn} accessibilityRole="button">
              {feed.isFetchingNextPage ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.filterBtnText}>{tr('Show more')}</Text>
              )}
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <EmptyState
              text={tr(
                filterCount > 0
                  ? 'No one matches these filters yet. Try removing a filter.'
                  : "You've reviewed everyone matching your preferences right now. New recommendations arrive with the weekly match refresh."
              )}
            />
          )
        }
      />
      <DiscoverFilterSheet
        visible={filterOpen}
        value={filters}
        cities={ref?.cities ?? []}
        states={ref?.states}
        sects={ref?.sects ?? []}
        maritalOptions={ref?.maritalOptions ?? []}
        onClose={() => setFilterOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setFilterOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = themedStyles(() =>
  StyleSheet.create({
    list: { padding: 16, paddingBottom: 32, gap: 12 },
    columnWrap: { gap: 12 },
    half: { flex: 1 },
    intro: { paddingHorizontal: 4, paddingBottom: 4 },
    introTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.ink },
    introText: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      gap: 14,
    },
    cardActive: { borderColor: colors.primary },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    avatar: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.greenBg,
      borderWidth: 2,
      borderColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: fonts.extraBold, fontSize: 20, color: colors.greenText },
    lockBadge: {
      position: 'absolute',
      right: -4,
      bottom: -4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockBadgeText: { fontSize: 10 },
    cardInfo: { flex: 1, minWidth: 0 },
    name: { fontFamily: fonts.extraBold, fontSize: 17, color: colors.ink },
    ageLine: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, marginTop: 3 },
    scorePill: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12 },
    scoreNum: { fontFamily: fonts.extraBold, fontSize: 16 },
    scoreLabel: { fontFamily: fonts.semiBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
    facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    fact: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: colors.borderHairline,
      maxWidth: '100%',
    },
    reasons: { gap: 6 },
    reasonsLabel: { fontFamily: fonts.semiBold, fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
    reasonChip: { backgroundColor: colors.greenBg, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 10 },
    reasonText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.greenText },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 10 },
    filterBtn: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    filterBtnOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterBtnText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.ink },
    clearText: { fontFamily: fonts.semiBold, fontSize: 13, color: colors.primary, textDecorationLine: 'underline' },
    moreBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
    factText: { fontFamily: fonts.semiBold, fontSize: 12, color: colors.ink },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.borderHairline,
      paddingTop: 12,
    },
    privacyNote: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
    viewLink: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.primary },
  })
);
