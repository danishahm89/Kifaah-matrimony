import { useQuery } from '@tanstack/react-query';
import { discoverApi, profilesApi } from '../client';
import { queryKeys } from '../queryClient';

export function useDiscover() {
  return useQuery({
    queryKey: queryKeys.discover,
    queryFn: discoverApi.list,
  });
}

export function useProfileDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.profileDetail(id ?? ''),
    queryFn: () => profilesApi.detail(id as string),
    enabled: !!id,
  });
}
