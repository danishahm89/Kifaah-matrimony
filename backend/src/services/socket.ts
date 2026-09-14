import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { verifyToken } from "../lib/jwt";
import { ChatMessage } from "@prisma/client";

let io: SocketIOServer | null = null;

/**
 * Attaches the /chat Socket.IO namespace to the HTTP server. Auth is via JWT
 * passed in the handshake (`auth.token` or `Authorization: Bearer <jwt>`
 * header) — the socket then joins room `user:<id>` so REST-side message
 * creation can push live delivery to both participants. REST remains the
 * source of truth; a client that misses a socket event can always fall back
 * to GET /api/chats/:userId/messages.
 */
export function attachSocket(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    path: "/socket.io",
    cors: { origin: "*" },
  });

  const chatNamespace = io.of("/chat");

  chatNamespace.use((socket: Socket, next) => {
    try {
      const token =
        (socket.handshake.auth && (socket.handshake.auth as { token?: string }).token) ||
        (socket.handshake.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("unauthorized"));
      const payload = verifyToken(token);
      (socket.data as { userId?: string }).userId = payload.userId;
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  chatNamespace.on("connection", (socket: Socket) => {
    const userId = (socket.data as { userId?: string }).userId;
    if (userId) {
      socket.join(`user:${userId}`);
    }
  });

  return io;
}

export function emitChatMessage(toUserId: string, message: ChatMessage) {
  if (!io) return;
  io.of("/chat").to(`user:${toUserId}`).emit("message", message);
}
