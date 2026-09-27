import { prisma } from "../lib/prisma";
import { appConfig } from "../lib/appConfig";

/**
 * Marks pending interests nobody answered within `interests.expireAfterDays`
 * as "expired", so members' request lists stay fresh. The sender can send
 * again later. Returns how many were expired.
 */
export async function expireOldInterests(now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - appConfig.interests.expireAfterDays * 24 * 60 * 60 * 1000);
  const result = await prisma.interestRequest.updateMany({
    where: { status: "pending", createdAt: { lt: cutoff } },
    data: { status: "expired" },
  });
  return result.count;
}
