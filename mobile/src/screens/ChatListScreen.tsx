import React, { useCallback } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { resolvePhotoUrl } from '../api/client';
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

  const statusLabel = (status?: ChatSummary['conversationStatus']) => {
    switch (status) {
      case 'closed':
        return 'Closed';
      case 'blocked':
        return 'Blocked';
      case 'reopen_requested':
        return 'Reopen requested';
      default:
        return null;
    }
  };

  const renderItem = ({ item }: { item: ChatSummary }) => {
    const resolvedPhoto = resolvePhotoUrl(item.photoUrl);
    const label = statusLabel(item.conversationStatus);
    return (
      <Pressable
        style={styles.row}
        onPress={() => navigation.navigate('ChatThread', { userId: item.userId, name: item.name })}
      >
        {resolvedPhoto ? (
          <Image source={{ uri: resolvedPhoto }} style={styles.photo} />
        ) : (
          <PlaceholderPhoto width={48} height={48} locked={false} />
        )}
        <View style={styles.rowBody}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.preview} numberOfLines={1}>
            {label ? `${label} · ` : ''}
            {item.canMessage === false && !label ? 'Not messageable yet · ' : ''}
            {item.lastMessage || 'Say hello'}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Screen edges={['top']}>
      <TabHeader title={tabStrings(lang).chat} />
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
  photo: {
    width: 48,
    height: 48,
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
