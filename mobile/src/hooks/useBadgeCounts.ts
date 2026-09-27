import { useConversations } from '../api/hooks/useChat';
import { useReceivedInterests } from '../api/hooks/useInterests';
import { useChatSeenStore } from '../store/chatSeenStore';

// Numbers shown on the Requests and Messages tabs.
export function useBadgeCounts() {
  const { data: received = [] } = useReceivedInterests();
  const { data: chats = [] } = useConversations();
  const seen = useChatSeenStore((s) => s.seen);

  const requests = received.filter((r) => r.status === 'pending').length;
  const messages = chats.filter((c) => {
    if (!c.lastMessageAt || !c.lastMessage) return false;
    const last = seen[c.userId];
    return !last || new Date(c.lastMessageAt).getTime() > new Date(last).getTime();
  }).length;

  return { Matches: requests, Chat: messages } as Record<string, number>;
}
