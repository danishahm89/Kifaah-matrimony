import { Router } from "express";
import { PRICING } from "../lib/pricing";

const router = Router();

router.get("/", (_req, res) => {
  res.json(PRICING);
});

export default router;
