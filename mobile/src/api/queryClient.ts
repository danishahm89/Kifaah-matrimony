import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  me: ['auth', 'me'] as const,
  reference: ['reference'] as const,
  profileMe: ['profile', 'me'] as const,
  discover: ['discover'] as const,
  profileDetail: (id: string) => ['profile', id] as const,
  interestsSent: ['interests', 'sent'] as const,
  interestsReceived: ['interests', 'received'] as const,
  chats: ['chats'] as const,
  chatMessages: (userId: string) => ['chats', userId, 'messages'] as const,
  waliShare: (userId: string) => ['chats', userId, 'wali-share'] as const,
  notifications: ['notifications'] as const,
  pricing: ['pricing'] as const,
  faq: ['faq'] as const,
  blocks: ['blocks'] as const,
};
