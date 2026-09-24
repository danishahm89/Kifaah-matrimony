import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { chatApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';
import { getChatSocket } from '../socket';
import { useAuthStore } from '../../store/authStore';

export function useConversations() {
  return useQuery({ queryKey: queryKeys.chats, queryFn: chatApi.conversations });
}

// Polls REST as the source of truth, and joins the Socket.IO /chat namespace for live
// delivery when available (falling back gracefully to plain polling if the socket doesn't
// connect — kept deliberately simple per CONTRACT.md's guidance).
export function useMessages(peerUserId: string | null) {
  const myId = useAuthStore((s) => s.user?.id);
  const [socketConnected, setSocketConnected] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.chatMessages(peerUserId ?? ''),
    queryFn: () => chatApi.messages(peerUserId as string),
    enabled: !!peerUserId,
    refetchInterval: () => (socketConnected ? false : 4000),
  });

  useEffect(() => {
    if (!peerUserId || !myId) return;
    const socket = getChatSocket();

    const onConnect = () => {
      setSocketConnected(true);
      socket.emit('join', { room: `user:${myId}` });
    };
    const onDisconnect = () => setSocketConnected(false);
    const onConnectError = () => setSocketConnected(false);
    const onMessage = (msg: { fromUserId: string; toUserId: string }) => {
      if (msg.fromUserId === peerUserId || msg.toUserId === peerUserId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(peerUserId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('message', onMessage);
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('message', onMessage);
    };
  }, [peerUserId, myId]);

  return query;
}

export function useSendMessage(peerUserId: string | null) {
  return useMutation({
    mutationFn: (text: string) => chatApi.send(peerUserId as string, text),
    onSuccess: () => {
      if (peerUserId) queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(peerUserId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chats });
    },
  });
}

// ---- Conversation lifecycle (CONTRACT.md §8.2/§8.8) ----
// All four just need `chats` (and the messages list, since a close/reopen can change whether
// sending is allowed) refetched afterwards — the row's new `conversationStatus`/`canMessage` is
// the only client-visible effect.
function invalidateConversation(userId: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.chats });
  queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(userId) });
}

export function useCloseConversation(userId: string) {
  return useMutation({
    mutationFn: () => chatApi.close(userId),
    onSuccess: () => invalidateConversation(userId),
  });
}

export function useRequestReopen(userId: string) {
  return useMutation({
    mutationFn: () => chatApi.requestReopen(userId),
    onSuccess: () => invalidateConversation(userId),
  });
}

export function useAcceptReopen(userId: string) {
  return useMutation({
    mutationFn: () => chatApi.acceptReopen(userId),
    onSuccess: () => invalidateConversation(userId),
  });
}

export function useRejectReopen(userId: string) {
  return useMutation({
    mutationFn: () => chatApi.rejectReopen(userId),
    onSuccess: () => invalidateConversation(userId),
  });
}

// ---- Wali sharing (CONTRACT.md §8.5) ----
export function useWaliShareStatus(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.waliShare(userId ?? ''),
    queryFn: () => chatApi.waliShareStatus(userId as string),
    enabled: !!userId && enabled,
  });
}

export function useCreateWaliShare(userId: string) {
  return useMutation({
    mutationFn: () => chatApi.createWaliShare(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.waliShare(userId) }),
  });
}

export function useRevokeWaliShare(userId: string) {
  return useMutation({
    mutationFn: () => chatApi.revokeWaliShare(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.waliShare(userId) }),
  });
}
