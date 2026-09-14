import { Router } from "express";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { runMatchEngineForUser } from "../services/matchEngine";

const router = Router();

// Dev/demo convenience mirroring the prototype's "Run this week's refresh
// now" button in Account — runs the engine for the calling user only.
router.post("/run-now", requireAuth, async (req: AuthedRequest, res) => {
  const notifications = await runMatchEngineForUser(req.userId!, "Week refresh (manual)");
  res.json({ notifications });
});

export default router;
