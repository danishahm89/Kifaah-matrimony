import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { TextField } from '../components/TextField';
import { ShieldIcon, SendIcon } from '../icons';
import { colors, fonts } from '../theme/tokens';
import { useMessages, useSendMessage } from '../api/hooks/useChat';
import { useAuthStore } from '../store/authStore';
import type { RootStackParamList } from '../navigation/types';
import type { ChatMessage } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

export function ChatThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props['route']>();
  const { userId, name } = route.params;
  const myId = useAuthStore((s) => s.user?.id);
  const chaperoneOn = useAuthStore((s) => s.user?.chaperoneChat ?? true);

  const { data: messages = [] } = useMessages(userId);
  const sendMessage = useSendMessage(userId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList>(null);

  const onSend = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    sendMessage.mutate(text);
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = item.fromUserId === myId;
    return (
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleThem]}>
        <Text style={styles.bubbleText}>{item.text}</Text>
      </View>
    );
  };

  return (
    <Screen>
      <Header title={name} onBack={() => navigation.goBack()} />
      {chaperoneOn ? (
        <View style={styles.chaperoneBanner}>
          <ShieldIcon size={14} />
          <Text style={styles.chaperoneText}>Visible to both families' guardians (wali), in line with Islamic etiquette.</Text>
        </View>
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }} keyboardVerticalOffset={90}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.inputRow}>
          <TextField
            style={{ flex: 1, maxHeight: 120 }}
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message..."
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Pressable style={styles.sendBtn} onPress={onSend}>
            <SendIcon />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chaperoneBanner: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.lowBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  chaperoneText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  messagesList: {
    padding: 16,
    gap: 10,
    flexGrow: 1,
  },
  bubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.lowBg,
  },
  bubbleThem: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bubbleThem,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.ink,
    fontFamily: fonts.regular,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingHorizontal: 16,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
