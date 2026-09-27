import { useMutation, useQuery } from '@tanstack/react-query';
import { accountApi, authApi } from '../client';
import { queryClient, queryKeys } from '../queryClient';
import { useAuthStore } from '../../store/authStore';
import { usePushStore } from '../../store/pushStore';
import { useOnboardingStore } from '../../store/onboardingStore';
import type { Gender } from '../../types';

export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: authApi.me,
    enabled,
  });
}

export function useSendOtp() {
  return useMutation({
    mutationFn: (phone: string) => authApi.sendOtp(phone),
  });
}

export function useVerifyOtp() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (vars: { phone: string; code: string; gender?: Gender }) =>
      authApi.verifyOtp(vars.phone, vars.code, vars.gender),
    onSuccess: async (data) => {
      await setSession(data.token, data.refreshToken, data.user);
      queryClient.invalidateQueries({ queryKey: queryKeys.me });
    },
  });
}

// Best-effort on both sides: unregister the device's push token and revoke the refresh token
// server-side, then always clear the local session regardless of whether those calls succeeded
// (e.g. offline logout) — CONTRACT.md §7.2/§7.4.
export function useLogout() {
  const storeLogout = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: async () => {
      const { refreshToken } = useAuthStore.getState();
      const expoPushToken = usePushStore.getState().expoPushToken;
      if (expoPushToken) {
        try {
          await accountApi.deletePushToken(expoPushToken);
        } catch {
          // ignore — token cleanup is best-effort
        }
      }
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken);
        } catch {
          // ignore — session is cleared locally regardless
        }
      }
    },
    onSettled: async () => {
      usePushStore.getState().setExpoPushToken(null);
      useOnboardingStore.getState().reset();
      await storeLogout();
      queryClient.clear();
    },
  });
}

// Permanently deletes the account on the server, then clears the local session.
export function useDeleteAccount() {
  const storeLogout = useAuthStore((s) => s.logout);
  return useMutation({
    mutationFn: () => accountApi.deleteAccount(),
    onSuccess: async () => {
      usePushStore.getState().setExpoPushToken(null);
      useOnboardingStore.getState().reset();
      await storeLogout();
      queryClient.clear();
    },
  });
}
