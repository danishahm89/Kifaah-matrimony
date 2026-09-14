import { useMutation, useQuery } from '@tanstack/react-query';
import { notificationsApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: notificationsApi.list,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationsRead() {
  return useMutation({
    mutationFn: notificationsApi.readAll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}
