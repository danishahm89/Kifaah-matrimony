import { Router } from "express";
import { reference } from "../data/reference";

const router = Router();

router.get("/", (_req, res) => {
  res.json(reference);
});

export default router;
