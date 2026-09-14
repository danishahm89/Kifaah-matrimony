import jwt from "jsonwebtoken";
import { env } from "./env";
import { appConfig } from "./appConfig";

export interface JwtPayload {
  userId: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: appConfig.auth.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

export const JWT_SECRET = env.JWT_SECRET;
