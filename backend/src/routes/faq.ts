import { Router } from "express";
import { faqs } from "../data/faq";

const router = Router();

router.get("/", (_req, res) => {
  res.json(faqs);
});

export default router;
