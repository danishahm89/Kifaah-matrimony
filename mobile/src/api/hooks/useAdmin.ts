import { useMutation, useQuery } from '@tanstack/react-query';
import { adminApi, AdminReport } from '../client';
import { queryClient } from '../queryClient';

const KEY = ['admin'] as const;
const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

export function useAdminReports(status: 'open' | 'all') {
  return useQuery({ queryKey: [...KEY, 'reports', status], queryFn: () => adminApi.reports(status) });
}

export function useAdminContactAttempts() {
  return useQuery({ queryKey: [...KEY, 'contact-attempts'], queryFn: adminApi.contactAttempts });
}

export function useSetReportStatus() {
  return useMutation({
    mutationFn: (v: { id: string; status: AdminReport['status'] }) => adminApi.setReportStatus(v.id, v.status),
    onSuccess: refresh,
  });
}

export function useSuspendUser() {
  return useMutation({
    mutationFn: (v: { userId: string; suspended: boolean }) => adminApi.suspend(v.userId, v.suspended),
    onSuccess: refresh,
  });
}
