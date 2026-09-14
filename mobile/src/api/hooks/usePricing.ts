import { useMutation, useQuery } from '@tanstack/react-query';
import { paymentsApi, pricingApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';

export function usePricing() {
  return useQuery({ queryKey: queryKeys.pricing, queryFn: pricingApi.get });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (vars: { tier: 'basic' | 'premium'; billing: 'monthly' | 'annual' }) =>
      paymentsApi.createOrder(vars.tier, vars.billing),
  });
}

export function useVerifyPayment() {
  return useMutation({
    mutationFn: (vars: { orderId: string; paymentId: string; signature: string }) =>
      paymentsApi.verify(vars.orderId, vars.paymentId, vars.signature),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
      queryClient.invalidateQueries({ queryKey: queryKeys.discover });
    },
  });
}
