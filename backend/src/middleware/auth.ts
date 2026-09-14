import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";

export interface AuthedRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
}
