import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './client';
import { useAuthStore } from '../store/authStore';

let socket: Socket | null = null;

// Lazily create (or reuse) the /chat namespace socket, authenticated via JWT in the
// handshake. REST remains the source of truth — this is purely a live-delivery nice-to-have,
// and callers should keep working (via polling) if the socket never connects.
export function getChatSocket(): Socket {
  if (socket) return socket;
  const token = useAuthStore.getState().token;
  socket = io(`${API_BASE_URL}/chat`, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 3,
    timeout: 5000,
  });
  return socket;
}

export function disconnectChatSocket() {
  socket?.disconnect();
  socket = null;
}
