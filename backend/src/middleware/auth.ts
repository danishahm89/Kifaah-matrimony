import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../lib/prisma";
import { isAdminPhone } from "../lib/admin";

export interface AuthedRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const token = header.slice("Bearer ".length).trim();
  let userId: string;
  try {
    userId = verifyToken(token).userId;
  } catch {
    return res.status(401).json({ error: "unauthorized" });
  }
  // A deleted or suspended member's token stops working straight away,
  // instead of when it expires.
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { suspended: true } });
    if (!user) return res.status(401).json({ error: "unauthorized" });
    if (user.suspended) return res.status(403).json({ error: "account_suspended" });
  } catch (err) {
    return next(err);
  }
  req.userId = userId;
  next();
}

/** Use after requireAuth. Only phones listed in ADMIN_PHONES get through. */
export async function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { phone: true } });
    if (!isAdminPhone(user?.phone)) return res.status(403).json({ error: "forbidden" });
  } catch (err) {
    return next(err);
  }
  next();
}
