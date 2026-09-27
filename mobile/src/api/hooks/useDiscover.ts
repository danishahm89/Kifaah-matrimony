import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import type { DiscoverFilters } from '../../types';
import { discoverApi, photoRequestsApi, profilesApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';

export function useDiscover() {
  return useQuery({
    queryKey: queryKeys.discover,
    queryFn: discoverApi.list,
  });
}

// Filtered feed, loaded 20 at a time. Keyed under queryKeys.discover so the
// existing invalidations (block, interest, report...) refresh it too.
export function useDiscoverFeed(filters: DiscoverFilters) {
  return useInfiniteQuery({
    queryKey: [...queryKeys.discover, 'feed', filters],
    queryFn: ({ pageParam }) => discoverApi.page(filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
  });
}

export function useProfileDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.profileDetail(id ?? ''),
    queryFn: () => profilesApi.detail(id as string),
    enabled: !!id,
  });
}

// ---- Explicit photo consent (CONTRACT.md §8.4) ----
// All three only ever affect the one profile's `photoAccessStatus` (mine, as the requester) or
// `incomingPhotoRequest` (theirs, as the owner) — refetching that profile's detail is enough.
export function useRequestPhoto(profileId: string) {
  return useMutation({
    mutationFn: () => profilesApi.requestPhoto(profileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profileDetail(profileId) }),
  });
}

export function useAcceptPhotoRequest(requesterProfileId: string) {
  return useMutation({
    mutationFn: (requestId: string) => photoRequestsApi.accept(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profileDetail(requesterProfileId) }),
  });
}

export function useRejectPhotoRequest(requesterProfileId: string) {
  return useMutation({
    mutationFn: (requestId: string) => photoRequestsApi.reject(requestId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profileDetail(requesterProfileId) }),
  });
}
