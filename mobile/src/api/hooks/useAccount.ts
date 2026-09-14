import { useMutation } from '@tanstack/react-query';
import { accountApi } from '../client';
import { useAuthStore } from '../../store/authStore';
import type { Language } from '../../types';

export function useToggleLanguage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: (language: Language) => accountApi.setLanguage(language),
    onMutate: async (language) => {
      const prev = user?.language;
      updateUser({ language });
      return { prev };
    },
    onError: (_err, _language, ctx) => {
      if (ctx?.prev) updateUser({ language: ctx.prev });
    },
  });
}

export function useSetChaperone() {
  const updateUser = useAuthStore((s) => s.updateUser);
  return useMutation({
    mutationFn: (chaperoneChat: boolean) => accountApi.setChaperone(chaperoneChat),
    onSuccess: (_data, chaperoneChat) => updateUser({ chaperoneChat }),
  });
}
