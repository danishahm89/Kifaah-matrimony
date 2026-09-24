import { env } from "./lib/env";
import { appConfig } from "./lib/appConfig";
import { sentryEnabled } from "./lib/sentry";
import http from "http";
import cron from "node-cron";
import { app } from "./app";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";
import { attachSocket } from "./services/socket";
import { runMatchEngineForUser } from "./services/matchEngine";
import { archiveOldClosedConversations } from "./services/conversations";

const server = http.createServer(app);
attachSocket(server);

server.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, nodeEnv: env.NODE_ENV, sentryEnabled, otp: env.twilioConfigured ? "twilio" : "console" },
    `Kifaah backend listening on :${env.PORT}`
  );
});

// Weekly match-engine cron — CONTRACT §4, default Monday 9am, configurable
// via config/*.yaml's matchEngine.cron.
const cronExpr = appConfig.matchEngine.cron;
if (cron.validate(cronExpr)) {
  cron.schedule(cronExpr, async () => {
    logger.info(`[match-engine] weekly run starting`);
    const users = await prisma.user.findMany({ select: { id: true } });
    for (const u of users) {
      try {
        await runMatchEngineForUser(u.id, "Weekly refresh");
      } catch (err) {
        logger.error({ err, userId: u.id }, "[match-engine] failed for user");
      }
    }
    logger.info("[match-engine] weekly run complete");
  });
} else {
  logger.warn(`MATCH_ENGINE_CRON "${cronExpr}" is not a valid cron expression — weekly job disabled`);
}

// Six-month conversation archive sweep (CONTRACT §8.9) — once daily is
// plenty, so this runs on a fixed schedule rather than a configurable one
// like the match engine's.
cron.schedule("0 3 * * *", async () => {
  try {
    const count = await archiveOldClosedConversations();
    logger.info({ count }, "[conversation-archive] sweep complete");
  } catch (err) {
    logger.error({ err }, "[conversation-archive] sweep failed");
  }
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
