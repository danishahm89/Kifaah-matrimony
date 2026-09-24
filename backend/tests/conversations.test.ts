import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { resetDb, makeAcceptedPair, createTestUser } from "./helpers";
import {
  closeConversation,
  requestReopen,
  acceptReopen,
  rejectReopen,
  findConversationForUsers,
} from "../src/services/conversations";

describe("Conversation state machine (CONTRACT §8.2)", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("interest acceptance creates an ACTIVE Conversation", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await findConversationForUsers(from.user.id, to.user.id);
    expect(conversation).not.toBeNull();
    expect(conversation!.status).toBe("ACTIVE");
  });

  it("ACTIVE -> CLOSED by either participant, ACTIVE -> CLOSED again is 409", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await findConversationForUsers(from.user.id, to.user.id);

    const closed = await closeConversation(conversation!.id, from.user.id);
    expect(closed.ok).toBe(true);
    if (closed.ok) expect(closed.conversation.status).toBe("CLOSED");

    const again = await closeConversation(conversation!.id, to.user.id);
    expect(again.ok).toBe(false);
    if (!again.ok) {
      expect(again.status).toBe(409);
      expect(again.error).toBe("invalid_transition");
    }
  });

  it("CLOSED -> REOPEN_REQUESTED, a second reopen-request while one is pending is 409", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await findConversationForUsers(from.user.id, to.user.id);
    await closeConversation(conversation!.id, from.user.id);

    const requested = await requestReopen(conversation!.id, from.user.id);
    expect(requested.ok).toBe(true);
    if (requested.ok) expect(requested.conversation.status).toBe("REOPEN_REQUESTED");

    const again = await requestReopen(conversation!.id, to.user.id);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.status).toBe(409);
  });

  it("REOPEN_REQUESTED -> ACTIVE only by the OTHER participant; the requester accepting their own request is 403", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await findConversationForUsers(from.user.id, to.user.id);
    await closeConversation(conversation!.id, from.user.id);
    await requestReopen(conversation!.id, from.user.id);

    const ownAccept = await acceptReopen(conversation!.id, from.user.id);
    expect(ownAccept.ok).toBe(false);
    if (!ownAccept.ok) expect(ownAccept.status).toBe(403);

    const otherAccept = await acceptReopen(conversation!.id, to.user.id);
    expect(otherAccept.ok).toBe(true);
    if (otherAccept.ok) expect(otherAccept.conversation.status).toBe("ACTIVE");
  });

  it("REOPEN_REQUESTED -> CLOSED via reject", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await findConversationForUsers(from.user.id, to.user.id);
    await closeConversation(conversation!.id, from.user.id);
    await requestReopen(conversation!.id, to.user.id);

    const rejected = await rejectReopen(conversation!.id, from.user.id);
    expect(rejected.ok).toBe(true);
    if (rejected.ok) expect(rejected.conversation.status).toBe("CLOSED");
  });

  it("rejects every transition not in the allowed list: CLOSED -> ACTIVE directly, accepting a reopen that was never requested", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await findConversationForUsers(from.user.id, to.user.id);
    await closeConversation(conversation!.id, from.user.id);

    // There's no direct "CLOSED -> ACTIVE" transition function exposed at
    // all — only requestReopen (-> REOPEN_REQUESTED) is reachable from
    // CLOSED. Confirm accept/reject on a non-pending conversation are 409.
    const accept = await acceptReopen(conversation!.id, to.user.id);
    expect(accept.ok).toBe(false);
    if (!accept.ok) expect(accept.status).toBe(409);

    const reject = await rejectReopen(conversation!.id, to.user.id);
    expect(reject.ok).toBe(false);
    if (!reject.ok) expect(reject.status).toBe(409);
  });

  it("sending a message while CLOSED is rejected with 409 invalid_transition semantics (403 conversation_not_active at the route)", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app)
      .post(`/api/chats/${to.user.id}/close`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);

    const res = await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "hello" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("conversation_not_active");
  });

  it("BLOCKED -> REOPEN_REQUESTED is allowed (same reopen flow as CLOSED)", async () => {
    const { from, to } = await makeAcceptedPair();
    const conversation = await findConversationForUsers(from.user.id, to.user.id);
    await prisma.conversation.update({ where: { id: conversation!.id }, data: { status: "BLOCKED" } });

    const requested = await requestReopen(conversation!.id, from.user.id);
    expect(requested.ok).toBe(true);
    if (requested.ok) expect(requested.conversation.status).toBe("REOPEN_REQUESTED");
  });

  describe("concurrent-race safety", () => {
    it("two concurrent close requests on the same ACTIVE conversation: exactly one wins, the other gets a clean 409", async () => {
      const { from, to } = await makeAcceptedPair();
      const conversation = await findConversationForUsers(from.user.id, to.user.id);

      const [a, b] = await Promise.all([
        closeConversation(conversation!.id, from.user.id),
        closeConversation(conversation!.id, to.user.id),
      ]);

      const results = [a, b];
      const successes = results.filter((r) => r.ok);
      const failures = results.filter((r) => !r.ok);
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
      if (!failures[0].ok) expect(failures[0].status).toBe(409);

      const final = await prisma.conversation.findUnique({ where: { id: conversation!.id } });
      expect(final!.status).toBe("CLOSED");
    });

    it("an accept racing a reject on the same REOPEN_REQUESTED conversation: exactly one applies", async () => {
      const { from, to } = await makeAcceptedPair();
      const conversation = await findConversationForUsers(from.user.id, to.user.id);
      await closeConversation(conversation!.id, from.user.id);
      await requestReopen(conversation!.id, from.user.id);

      // Both calls are made by `to` (the other participant) — one tries to
      // accept, one tries to reject, at the same time.
      const [acceptResult, rejectResult] = await Promise.all([
        acceptReopen(conversation!.id, to.user.id),
        rejectReopen(conversation!.id, to.user.id),
      ]);

      const results = [acceptResult, rejectResult];
      const successes = results.filter((r) => r.ok);
      expect(successes.length).toBe(1);

      const final = await prisma.conversation.findUnique({ where: { id: conversation!.id } });
      expect(["ACTIVE", "CLOSED"]).toContain(final!.status);
    });
  });
});

describe("Close/reopen HTTP routes (CONTRACT §8.8)", () => {
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("either participant can close; reading messages afterwards still works, sending does not", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app)
      .post(`/api/chats/${from.user.id}/messages`)
      .set("Authorization", `Bearer ${to.token}`)
      .send({ text: "hi before close" })
      .expect(201);

    await request(app)
      .post(`/api/chats/${to.user.id}/close`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);

    const history = await request(app)
      .get(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);
    expect(history.body.messages.length).toBe(1);
    expect(history.body.conversationStatus).toBe("closed");

    const send = await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "should fail" });
    expect(send.status).toBe(403);
    expect(send.body.error).toBe("conversation_not_active");
  });

  it("reopen-request then only the other participant can accept; the requester gets 403", async () => {
    const { from, to } = await makeAcceptedPair();
    await request(app).post(`/api/chats/${to.user.id}/close`).set("Authorization", `Bearer ${from.token}`).expect(200);
    await request(app)
      .post(`/api/chats/${to.user.id}/reopen-request`)
      .set("Authorization", `Bearer ${from.token}`)
      .expect(200);

    const selfAccept = await request(app)
      .post(`/api/chats/${to.user.id}/reopen-request/accept`)
      .set("Authorization", `Bearer ${from.token}`);
    expect(selfAccept.status).toBe(403);

    const otherAccept = await request(app)
      .post(`/api/chats/${from.user.id}/reopen-request/accept`)
      .set("Authorization", `Bearer ${to.token}`);
    expect(otherAccept.status).toBe(200);
    expect(otherAccept.body.conversationStatus).toBe("active");

    // Sending works again now that it's ACTIVE.
    await request(app)
      .post(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${from.token}`)
      .send({ text: "back online" })
      .expect(201);
  });

  it("GET /api/chats includes accepted-but-not-both-subscribed pairs with canMessage:false instead of omitting them", async () => {
    // Build a pair where only one side is subscribed.
    const a = await createTestUser("bride", { subscribed: true });
    const b = await createTestUser("groom", { subscribed: false });

    const sent = await request(app)
      .post(`/api/interests/${b.user.id}`)
      .set("Authorization", `Bearer ${a.token}`)
      .send({})
      .expect(201);
    await request(app)
      .post(`/api/interests/${sent.body.id}/accept`)
      .set("Authorization", `Bearer ${b.token}`)
      .expect(200);

    const list = await request(app).get("/api/chats").set("Authorization", `Bearer ${a.token}`).expect(200);
    const row = list.body.find((c: any) => c.userId === b.user.id);
    expect(row).toBeTruthy();
    expect(row.canMessage).toBe(false);
    expect(row.canMessageReason).toBe("not_subscribed");
  });

  it("a non-participant reading a conversation's messages is rejected", async () => {
    const { to } = await makeAcceptedPair();
    const stranger = await createTestUser("groom");

    const res = await request(app)
      .get(`/api/chats/${to.user.id}/messages`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });

  it("reopening a conversation without a pending REOPEN_REQUESTED state is 409", async () => {
    const { from, to } = await makeAcceptedPair();
    const res = await request(app)
      .post(`/api/chats/${from.user.id}/reopen-request/accept`)
      .set("Authorization", `Bearer ${to.token}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("invalid_transition");
  });
});
