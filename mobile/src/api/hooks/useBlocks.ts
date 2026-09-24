import { useMutation, useQuery } from '@tanstack/react-query';
import { blocksApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';

// CONTRACT.md §8.3 — blocking. Any successful block/unblock can change discover, interests, chats
// and notifications (blocked pairs are excluded from all of them), so invalidate broadly rather
// than trying to patch each cache individually.
function invalidateBlockRelated() {
  queryClient.invalidateQueries({ queryKey: queryKeys.blocks });
  queryClient.invalidateQueries({ queryKey: queryKeys.discover });
  queryClient.invalidateQueries({ queryKey: queryKeys.interestsSent });
  queryClient.invalidateQueries({ queryKey: queryKeys.interestsReceived });
  queryClient.invalidateQueries({ queryKey: queryKeys.chats });
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
}

export function useBlockedUsers() {
  return useQuery({ queryKey: queryKeys.blocks, queryFn: blocksApi.list });
}

export function useBlockUser() {
  return useMutation({
    mutationFn: (userId: string) => blocksApi.block(userId),
    onSuccess: (_data, userId) => {
      invalidateBlockRelated();
      queryClient.invalidateQueries({ queryKey: queryKeys.profileDetail(userId) });
    },
  });
}

export function useUnblockUser() {
  return useMutation({
    mutationFn: (userId: string) => blocksApi.unblock(userId),
    onSuccess: invalidateBlockRelated,
  });
}
