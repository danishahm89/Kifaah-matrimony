import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The `url` POST /api/chats/:userId/wali-share returns points straight at
// this endpoint (there's no separate web frontend) — a Wali opens it from a
// share sheet / SMS / WhatsApp link, which always requests text/html, so
// render a minimal read-only page for that case instead of raw JSON. Only
// when the Accept header explicitly asks for HTML — no header at all (e.g.
// supertest in the test suite) keeps returning JSON, unchanged.
function wantsHtml(req: import("express").Request): boolean {
  return !!req.headers.accept && req.headers.accept.includes("text/html");
}

function renderHtml(participants: { from: { name: string }; to: { name: string } }, messages: Array<{ fromUserId: string; text: string; createdAt: Date }>, fromUserId: string): string {
  const rows = messages
    .map((m) => {
      const who = m.fromUserId === fromUserId ? participants.from.name : participants.to.name;
      return `<div class="msg"><span class="who">${escapeHtml(who)}</span><p>${escapeHtml(m.text)}</p><time>${new Date(m.createdAt).toLocaleString()}</time></div>`;
    })
    .join("\n");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kifaah — Conversation (read-only)</title>
<style>
body{font-family:system-ui,sans-serif;background:#f3f2f2;color:#201e1d;margin:0;padding:20px;max-width:640px;margin:0 auto}
h1{font-size:18px}
.notice{font-size:13px;color:#605d5d;background:#eae9e9;padding:12px;margin-bottom:20px}
.msg{border-bottom:1px solid rgba(32,30,29,0.12);padding:12px 0}
.who{font-weight:700;font-size:13px}
.msg p{margin:4px 0;font-size:14px;white-space:pre-wrap}
time{font-size:11px;color:#605d5d}
</style></head>
<body>
<h1>Conversation between ${escapeHtml(participants.from.name)} and ${escapeHtml(participants.to.name)}</h1>
<div class="notice">Read-only view shared for guardian oversight. This link can be revoked at any time by the person who shared it.</div>
${rows || '<p style="color:#605d5d">No messages yet.</p>'}
</body></html>`;
}

// CONTRACT §8.5 — unauthenticated, read-only. The token itself is the
// credential; no JWT is involved and this conversation's data is never
// exposed through any other unauthenticated route.
router.get("/:token", async (req, res) => {
  const share = await prisma.waliShare.findUnique({ where: { accessToken: req.params.token } });
  if (!share || share.revoked) {
    if (wantsHtml(req)) {
      return res.status(404).type("html").send("<!DOCTYPE html><title>Not found</title><body>This link is invalid or has been revoked.</body>");
    }
    return res.status(404).json({ error: "not_found" });
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: share.conversationId } });
  if (!conversation) return res.status(404).json({ error: "not_found" });

  const interest = await prisma.interestRequest.findUnique({ where: { id: conversation.interestId } });
  if (!interest) return res.status(404).json({ error: "not_found" });

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: interest.fromUserId }, include: { profile: true } }),
    prisma.user.findUnique({ where: { id: interest.toUserId }, include: { profile: true } }),
  ]);

  const messages = await prisma.chatMessage.findMany({
    where: {
      OR: [
        { fromUserId: interest.fromUserId, toUserId: interest.toUserId },
        { fromUserId: interest.toUserId, toUserId: interest.fromUserId },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, fromUserId: true, toUserId: true, text: true, createdAt: true },
  });

  await prisma.waliShare.update({ where: { id: share.id }, data: { lastViewedAt: new Date() } });

  const participants = {
    from: { id: interest.fromUserId, name: fromUser?.profile?.name || "Member" },
    to: { id: interest.toUserId, name: toUser?.profile?.name || "Member" },
  };

  if (wantsHtml(req)) {
    return res.type("html").send(renderHtml(participants, messages, interest.fromUserId));
  }
  res.json({ participants, messages });
});

export default router;
