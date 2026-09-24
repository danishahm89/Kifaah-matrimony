import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/Screen';
import { Header } from '../components/Header';
import { ShieldIcon, SendIcon } from '../icons';
import { colors, fonts } from '../theme/tokens';
import {
  useMessages,
  useSendMessage,
  useConversations,
  useCloseConversation,
  useRequestReopen,
  useAcceptReopen,
  useRejectReopen,
  useWaliShareStatus,
  useCreateWaliShare,
  useRevokeWaliShare,
} from '../api/hooks/useChat';
import { useBlockUser } from '../api/hooks/useBlocks';
import { useAuthStore } from '../store/authStore';
import { useToastStore } from '../store/uiStore';
import { useScreenshotReporting } from '../hooks/useScreenshotReporting';
import { deriveChatThreadState } from './chatThreadState';
import type { RootStackParamList } from '../navigation/types';
import type { ChatMessage } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatThread'>;

const MIN_INPUT_HEIGHT = 40;
const MAX_INPUT_HEIGHT = 118; // ~5 lines, then the input scrolls internally.

export function ChatThreadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Props['route']>();
  const { userId } = route.params;
  const myId = useAuthStore((s) => s.user?.id);
  const isBride = useAuthStore((s) => s.user?.gender === 'bride');
  const chaperoneOn = useAuthStore((s) => s.user?.chaperoneChat ?? true);
  const showToast = useToastStore((s) => s.show);

  // `useConversations` is process-wide cached (React Query) — this is the same GET /api/chats
  // list ChatListScreen renders, just filtered down to this one row for its
  // conversationStatus/canMessage/conversationId (CONTRACT.md §8.8). Falls back gracefully (see
  // deriveChatThreadState) when the row isn't found yet (e.g. opened straight from ProfileDetail
  // before the list has ever loaded) or the backend hasn't landed these fields yet.
  const { data: conversations = [] } = useConversations();
  const conversation = conversations.find((c) => c.userId === userId);
  const name = route.params.name || conversation?.name || 'Chat';

  const uiState = useMemo(
    () =>
      deriveChatThreadState({
        status: conversation?.conversationStatus,
        canMessage: conversation?.canMessage,
        canMessageReason: conversation?.canMessageReason,
        reopenRequestedByUserId: conversation?.reopenRequestedByUserId,
        myUserId: myId,
      }),
    [conversation, myId]
  );

  useScreenshotReporting(conversation?.conversationId);

  const { data: messages = [] } = useMessages(userId);
  const sendMessage = useSendMessage(userId);
  const [draft, setDraft] = useState('');
  const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);
  const listRef = useRef<FlatList>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const closeConversation = useCloseConversation(userId);
  const requestReopen = useRequestReopen(userId);
  const acceptReopen = useAcceptReopen(userId);
  const rejectReopen = useRejectReopen(userId);
  const blockUser = useBlockUser();
  const waliShareStatus = useWaliShareStatus(userId, isBride);
  const createWaliShare = useCreateWaliShare(userId);
  const revokeWaliShare = useRevokeWaliShare(userId);

  const onSend = () => {
    const text = draft.trim();
    if (!text || !uiState.composerEnabled) return;
    setDraft('');
    setInputHeight(MIN_INPUT_HEIGHT);
    sendMessage.mutate(text, {
      onError: () => showToast('Could not send that message. Please try again.'),
    });
  };

  const onCloseConversation = () => {
    setMenuOpen(false);
    Alert.alert(
      'Close this conversation?',
      'Are you sure you want to close this conversation? Existing approvals will be reset.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () =>
            closeConversation.mutate(undefined, {
              onSuccess: () => showToast('Conversation closed.'),
              onError: () => showToast('Could not close this conversation. Please try again.'),
            }),
        },
      ]
    );
  };

  const onRequestReopen = () => {
    setMenuOpen(false);
    requestReopen.mutate(undefined, {
      onSuccess: () => showToast('Reopen request sent.'),
      onError: () => showToast('Could not send a reopen request. Please try again.'),
    });
  };

  const onBlock = () => {
    setMenuOpen(false);
    Alert.alert('Block this user?', 'Are you sure you want to block this user?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          blockUser.mutate(userId, {
            onSuccess: () => {
              showToast(`${name} has been blocked.`);
              navigation.goBack();
            },
            onError: () => showToast('Could not block this user. Please try again.'),
          }),
      },
    ]);
  };

  const onShareWithWali = async () => {
    setMenuOpen(false);
    try {
      const result = await createWaliShare.mutateAsync();
      await Share.share({
        message: `Assalamu alaikum — here is a read-only link to view my conversation on Kifaah: ${result.url}`,
        url: result.url,
      });
    } catch {
      showToast('Could not create a Wali share link. Please try again.');
    }
  };

  const onRevokeWaliShare = () => {
    setMenuOpen(false);
    Alert.alert('Revoke Wali access?', 'The link you shared will stop working immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: () => revokeWaliShare.mutate(),
      },
    ]);
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const mine = item.fromUserId === myId;
    return (
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleThem]}>
        <Text style={styles.bubbleText}>{item.text}</Text>
      </View>
    );
  };

  const banner = uiState.banner;

  return (
    <Screen>
      <Header
        title={name}
        onBack={() => navigation.goBack()}
        right={
          <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={8} style={styles.menuBtn}>
            <Text style={styles.menuBtnText}>⋯</Text>
          </Pressable>
        }
      />

      {menuOpen ? (
        <View style={styles.menuPanel}>
          {uiState.showClose ? (
            <Pressable style={styles.menuRow} onPress={onCloseConversation}>
              <Text style={styles.menuRowText}>Close Conversation</Text>
            </Pressable>
          ) : null}
          {uiState.showRequestReopen ? (
            <Pressable style={styles.menuRow} onPress={onRequestReopen} disabled={requestReopen.isPending}>
              <Text style={styles.menuRowText}>Request Reopen</Text>
            </Pressable>
          ) : null}
          {isBride ? (
            waliShareStatus.data?.status === 'active' ? (
              <Pressable style={styles.menuRow} onPress={onRevokeWaliShare}>
                <Text style={styles.menuRowText}>Wali share: Active — Revoke</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.menuRow} onPress={onShareWithWali} disabled={createWaliShare.isPending}>
                <Text style={styles.menuRowText}>Share Conversation with Wali</Text>
              </Pressable>
            )
          ) : null}
          <Pressable style={styles.menuRow} onPress={onBlock}>
            <Text style={[styles.menuRowText, { color: colors.redDark }]}>Block {name}</Text>
          </Pressable>
        </View>
      ) : null}

      {chaperoneOn ? (
        <View style={styles.chaperoneBanner}>
          <ShieldIcon size={14} />
          <Text style={styles.chaperoneText}>Visible to both families' guardians (wali), in line with Islamic etiquette.</Text>
        </View>
      ) : null}

      {banner.kind !== 'none' ? (
        <View style={styles.lifecycleBanner}>
          {banner.kind === 'closed' ? <Text style={styles.lifecycleText}>Conversation Closed</Text> : null}
          {banner.kind === 'blocked' ? <Text style={styles.lifecycleText}>This conversation is blocked.</Text> : null}
          {banner.kind === 'limited' ? (
            <Text style={styles.lifecycleText}>
              You can see this connection, but messaging opens once both sides have an active subscription.
            </Text>
          ) : null}
          {banner.kind === 'reopen_requested_by_me' ? (
            <>
              <Text style={styles.lifecycleText}>Reopen request sent — waiting for {name} to respond.</Text>
              {/* The backend allows the requester to cancel their own pending reopen request (it's
                  the same POST .../reopen-request/reject route, just called by the requester
                  instead of the recipient) — surface that capability rather than only letting them wait. */}
              <Pressable
                style={[styles.lifecycleBtn, { marginTop: 8 }]}
                onPress={() =>
                  rejectReopen.mutate(undefined, {
                    onError: () => showToast('Could not cancel the reopen request. Please try again.'),
                  })
                }
                disabled={rejectReopen.isPending}
              >
                <Text style={styles.lifecycleBtnText}>Cancel Request</Text>
              </Pressable>
            </>
          ) : null}
          {banner.kind === 'reopen_requested_by_them' ? (
            <>
              <Text style={styles.lifecycleText}>{name} wants to reopen this conversation.</Text>
              <View style={styles.lifecycleActions}>
                <Pressable
                  style={[styles.lifecycleBtn, styles.lifecycleBtnPrimary]}
                  onPress={() =>
                    acceptReopen.mutate(undefined, {
                      onError: () => showToast('Could not accept the reopen request. Please try again.'),
                    })
                  }
                >
                  <Text style={styles.lifecycleBtnPrimaryText}>Accept</Text>
                </Pressable>
                <Pressable
                  style={styles.lifecycleBtn}
                  onPress={() =>
                    rejectReopen.mutate(undefined, {
                      onError: () => showToast('Could not reject the reopen request. Please try again.'),
                    })
                  }
                >
                  <Text style={styles.lifecycleBtnText}>Reject</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {banner.kind === 'closed' || banner.kind === 'blocked' ? (
            <Pressable
              style={[styles.lifecycleBtn, styles.lifecycleBtnPrimary, { marginTop: 8 }]}
              onPress={onRequestReopen}
              disabled={requestReopen.isPending}
            >
              <Text style={styles.lifecycleBtnPrimaryText}>Request Reopen</Text>
            </Pressable>
          ) : null}
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
          <View style={[styles.inputBorder, { height: Math.max(MIN_INPUT_HEIGHT, inputHeight) }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={uiState.composerEnabled ? 'Type a message' : 'Messaging is unavailable right now'}
              placeholderTextColor={colors.muted}
              editable={uiState.composerEnabled}
              multiline
              style={[styles.input, { height: Math.max(MIN_INPUT_HEIGHT, inputHeight) - 2 }]}
              onContentSizeChange={(e) => {
                const next = Math.min(MAX_INPUT_HEIGHT, Math.max(MIN_INPUT_HEIGHT, e.nativeEvent.contentSize.height + 18));
                setInputHeight(next);
              }}
            />
          </View>
          <Pressable
            style={[styles.sendBtn, (!draft.trim() || !uiState.composerEnabled) && styles.sendBtnDisabled]}
            onPress={onSend}
            disabled={!draft.trim() || !uiState.composerEnabled}
          >
            <SendIcon />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  menuBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnText: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.ink,
  },
  menuPanel: {
    position: 'absolute',
    top: 52,
    right: 12,
    left: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    zIndex: 30,
    elevation: 6,
  },
  menuRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  menuRowText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.ink,
  },
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
  lifecycleBanner: {
    padding: 14,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderHairline,
  },
  lifecycleText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.ink,
    lineHeight: 19,
  },
  lifecycleActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  lifecycleBtn: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  lifecycleBtnPrimary: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  lifecycleBtnText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.ink,
  },
  lifecycleBtnPrimaryText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.bg,
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
    alignItems: 'flex-end',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  inputBorder: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  sendBtn: {
    width: 40,
    height: 40,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
