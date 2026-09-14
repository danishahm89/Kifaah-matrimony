import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Screen } from '../components/Screen';
import { TabHeader } from '../components/TabHeader';
import { PlaceholderPhoto } from '../components/PlaceholderPhoto';
import { EmptyState } from '../components/EmptyState';
import { colors, fonts } from '../theme/tokens';
import { useConversations } from '../api/hooks/useChat';
import { useAuthStore } from '../store/authStore';
import { tabStrings } from '../i18n/strings';
import type { RootStackParamList, MainTabParamList } from '../navigation/types';
import type { ChatSummary } from '../types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Chat'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function ChatListScreen() {
  const navigation = useNavigation<Nav>();
  const lang = useAuthStore((s) => s.user?.language ?? 'en');
  const { data: chats = [], isLoading, refetch, isRefetching } = useConversations();

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const renderItem = ({ item }: { item: ChatSummary }) => (
    <Pressable
      style={styles.row}
      onPress={() => navigation.navigate('ChatThread', { userId: item.userId, name: item.name })}
    >
      <PlaceholderPhoto width={48} height={48} locked={false} />
      <View style={styles.rowBody}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.preview} numberOfLines={1}>
          {item.lastMessage || 'Say hello'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <Screen edges={['top']}>
      <TabHeader
        title={tabStrings(lang).chat}
        onOpenNotification={(candidateId) => navigation.navigate('ProfileDetail', { profileId: candidateId, origin: 'notification' })}
      />
      <FlatList
        data={chats}
        keyExtractor={(item) => item.userId}
        renderItem={renderItem}
        refreshing={isRefetching && !isLoading}
        onRefresh={refetch}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState text="No conversations yet. Chats open once you both subscribe and a request is accepted." />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  preview: {
    fontSize: 12,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
});
