import { useMutation } from '@tanstack/react-query';
import { reportsApi, ReportReason } from '../client';
import { queryClient, queryKeys } from '../queryClient';

export function useReportUser() {
  return useMutation({
    mutationFn: (v: { userId: string; reason: ReportReason; details?: string; block: boolean }) =>
      reportsApi.report(v.userId, { reason: v.reason, details: v.details, block: v.block }),
    onSuccess: (res) => {
      if (res.blocked) {
        // A report with block hides this member everywhere.
        queryClient.invalidateQueries({ queryKey: queryKeys.blocks });
        queryClient.invalidateQueries({ queryKey: queryKeys.discover });
        queryClient.invalidateQueries({ queryKey: queryKeys.interestsSent });
        queryClient.invalidateQueries({ queryKey: queryKeys.interestsReceived });
        queryClient.invalidateQueries({ queryKey: queryKeys.chats });
      }
    },
  });
}
