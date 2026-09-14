import { useMutation, useQuery } from '@tanstack/react-query';
import { interestsApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';

export function useSentInterests() {
  return useQuery({ queryKey: queryKeys.interestsSent, queryFn: interestsApi.sent });
}

export function useReceivedInterests() {
  return useQuery({ queryKey: queryKeys.interestsReceived, queryFn: interestsApi.received });
}

function invalidateInterestRelated(profileId?: string) {
  queryClient.invalidateQueries({ queryKey: queryKeys.discover });
  queryClient.invalidateQueries({ queryKey: queryKeys.interestsSent });
  queryClient.invalidateQueries({ queryKey: queryKeys.interestsReceived });
  queryClient.invalidateQueries({ queryKey: queryKeys.chats });
  if (profileId) queryClient.invalidateQueries({ queryKey: queryKeys.profileDetail(profileId) });
}

export function useSendInterest() {
  return useMutation({
    mutationFn: (profileId: string) => interestsApi.send(profileId),
    onSuccess: (_data, profileId) => invalidateInterestRelated(profileId),
  });
}

export function useAcceptInterest() {
  return useMutation({
    mutationFn: (vars: { id: string; profileId?: string }) => interestsApi.accept(vars.id),
    onSuccess: (_data, vars) => invalidateInterestRelated(vars.profileId),
  });
}

export function useDeclineInterest() {
  return useMutation({
    mutationFn: (vars: { id: string; profileId?: string }) => interestsApi.decline(vars.id),
    onSuccess: (_data, vars) => invalidateInterestRelated(vars.profileId),
  });
}
