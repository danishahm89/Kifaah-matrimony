import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Runs once, before any test file, in its own context (vitest's
// `globalSetup`) — truncates the test DB so the suite starts from a known
// empty state regardless of what order test files run in.
export default async function globalSetup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/kifaah_test?schema=public";
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    await prisma.$transaction([
      prisma.securityEvent.deleteMany(),
      prisma.waliShare.deleteMany(),
      prisma.photoAccessRequest.deleteMany(),
      prisma.conversation.deleteMany(),
      prisma.blockedUser.deleteMany(),
      prisma.auditLog.deleteMany(),
      prisma.pushToken.deleteMany(),
      prisma.refreshToken.deleteMany(),
      prisma.notification.deleteMany(),
      prisma.chatMessage.deleteMany(),
      prisma.interestRequest.deleteMany(),
      prisma.profile.deleteMany(),
      prisma.subscription.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  } finally {
    await prisma.$disconnect();
  }
}
