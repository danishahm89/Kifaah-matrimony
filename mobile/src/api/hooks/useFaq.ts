import { useQuery } from '@tanstack/react-query';
import { faqApi } from '../client';
import { queryKeys } from '../queryClient';

export function useFaq() {
  return useQuery({ queryKey: queryKeys.faq, queryFn: faqApi.list, staleTime: 1000 * 60 * 60 });
}
