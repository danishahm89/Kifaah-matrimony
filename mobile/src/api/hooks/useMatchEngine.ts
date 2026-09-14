import { useMutation } from '@tanstack/react-query';
import { matchEngineApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';

export function useRunMatchEngine() {
  return useMutation({
    mutationFn: matchEngineApi.runNow,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      queryClient.invalidateQueries({ queryKey: queryKeys.discover });
    },
  });
}
