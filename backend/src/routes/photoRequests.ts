import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { createNotification } from "../lib/notifications";

const router = Router();

// CONTRACT §8.4/§8.12 — owner-only (403 otherwise, whether the caller is the
// requester or an unrelated third party).
async function decide(req: AuthedRequest, res: import("express").Response, status: "accepted" | "rejected") {
  const request = await prisma.photoAccessRequest.findUnique({ where: { id: req.params.id } });
  if (!request) return res.status(404).json({ error: "not_found" });
  if (request.ownerId !== req.userId) return res.status(403).json({ error: "forbidden" });

  const updated = await prisma.photoAccessRequest.update({
    where: { id: request.id },
    data: { status },
  });

  const ownerProfile = await prisma.profile.findUnique({ where: { userId: request.ownerId } });
  await createNotification({
    userId: request.requesterId,
    type: status === "accepted" ? "photo_request_accepted" : "photo_request_rejected",
    title: status === "accepted" ? "Photo request accepted" : "Photo request declined",
    message:
      status === "accepted"
        ? `${ownerProfile?.name || "Someone"} accepted your photo request.`
        : `${ownerProfile?.name || "Someone"} declined your photo request.`,
    referenceId: request.ownerId,
    fromUserId: request.ownerId,
    push: true,
  });

  res.json(updated);
}

router.post("/:id/accept", requireAuth, (req: AuthedRequest, res) => decide(req, res, "accepted"));
router.post("/:id/reject", requireAuth, (req: AuthedRequest, res) => decide(req, res, "rejected"));

export default router;
