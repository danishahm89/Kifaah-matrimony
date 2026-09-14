import { useQuery } from '@tanstack/react-query';
import { referenceApi } from '../client';
import { queryKeys } from '../queryClient';

export function useReference() {
  return useQuery({
    queryKey: queryKeys.reference,
    queryFn: referenceApi.get,
    staleTime: 1000 * 60 * 60, // reference/option lists barely change
  });
}
