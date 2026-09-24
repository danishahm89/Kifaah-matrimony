import { prisma } from "../lib/prisma";
import { findConversationForUsers } from "./conversations";

export type PhotoAccessStatus = "none" | "pending" | "accepted" | "rejected";

/**
 * The viewer's own PhotoAccessRequest status against `ownerId`, for
 * GET /api/profiles/:id's `photoAccessStatus` field (CONTRACT §8.4). "none"
 * when there's no accepted interest between them yet, or no request has been
 * made.
 */
export async function getPhotoAccessStatus(viewerId: string, ownerId: string): Promise<PhotoAccessStatus> {
  const conversation = await findConversationForUsers(viewerId, ownerId);
  if (!conversation) return "none";
  const request = await prisma.photoAccessRequest.findUnique({
    where: { conversationId_requesterId: { conversationId: conversation.id, requesterId: viewerId } },
  });
  return (request?.status as PhotoAccessStatus) ?? "none";
}

/**
 * The reverse direction: has `candidateId` (the profile being viewed) asked
 * `viewerId` (the profile owner, currently looking at their profile) for
 * *viewer's* photo? Surfaced on GET /api/profiles/:id as `incomingPhotoRequest`
 * so both directions of consent are visible on the same screen. Only a
 * `pending` request is actionable, so that's all this returns.
 */
export async function getIncomingPhotoRequest(
  viewerId: string,
  candidateId: string
): Promise<{ id: string; status: "pending" } | null> {
  const conversation = await findConversationForUsers(viewerId, candidateId);
  if (!conversation) return null;
  const request = await prisma.photoAccessRequest.findUnique({
    where: { conversationId_requesterId: { conversationId: conversation.id, requesterId: candidateId } },
  });
  if (!request || request.status !== "pending") return null;
  return { id: request.id, status: "pending" };
}
