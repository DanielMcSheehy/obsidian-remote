import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { config } from "../lib/config.js";
import { createBus, createMemoryStore, resetBus, useBus, VAULT } from "../lib/inbox.js";
import { inboxRoutes } from "./inbox.js";

const app = Fastify();
const adminHeaders = config.appPassword ? { authorization: `Bearer ${config.appPassword}` } : {};

before(async () => {
  useBus(createBus(createMemoryStore()));
  await inboxRoutes(app);
  await app.ready();
});

after(async () => {
  await app.close();
  resetBus();
});

test("register + vault open + agent pull + reply", async () => {
  const reg = await app.inject({
    method: "POST",
    url: "/api/agents/register",
    headers: adminHeaders,
    payload: { name: "research" },
  });
  assert.equal(reg.statusCode, 200);
  const regBody: unknown = reg.json();
  assert.ok(regBody && typeof regBody === "object" && "agent" in regBody);
  const agent = (regBody as { agent: { token: string } }).agent;
  const token = agent.token;

  const opened = await app.inject({
    method: "POST",
    url: "/api/inbox/open",
    headers: adminHeaders,
    payload: { to: "research", topic: "task", body: "please file this" },
  });
  assert.equal(opened.statusCode, 200);
  const sent = opened.json() as { thread_id: string; status: string };
  assert.equal(sent.status, "delivered");
  assert.ok(sent.thread_id);

  const pulled = await app.inject({
    method: "GET",
    url: "/api/inbox?full=1",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(pulled.statusCode, 200);
  const box = pulled.json() as {
    self: string;
    threads: Array<{ id: string; unread: number; messages: Array<{ author: string }> }>;
  };
  assert.equal(box.self, "research");
  assert.equal(box.threads.length, 1);
  assert.equal(box.threads[0].unread, 1);
  assert.equal(box.threads[0].messages[0].author, VAULT);

  const reply = await app.inject({
    method: "POST",
    url: `/api/inbox/threads/${sent.thread_id}/reply`,
    headers: { authorization: `Bearer ${token}` },
    payload: { body: "filed" },
  });
  assert.equal(reply.statusCode, 200);
  assert.equal((reply.json() as { thread_id: string }).thread_id, sent.thread_id);

  const vault = await app.inject({ method: "GET", url: "/api/inbox", headers: adminHeaders });
  const v = vault.json() as { self: string; threads: Array<{ unread: number }> };
  assert.equal(v.self, VAULT);
  assert.equal(v.threads[0].unread, 1);
});

test("POST /api/inbox is gone; from cannot be spoofed", async () => {
  const gone = await app.inject({
    method: "POST",
    url: "/api/inbox",
    headers: adminHeaders,
    payload: { to: "research", from: "mcp", subject: "hi", body: "x" },
  });
  assert.equal(gone.statusCode, 404);

  await app.inject({ method: "POST", url: "/api/agents/register", headers: adminHeaders, payload: { name: "ops" } });
  const opened = await app.inject({
    method: "POST",
    url: "/api/inbox/open",
    headers: adminHeaders,
    payload: { to: "ops", topic: "x", body: "y", from: "ops" },
  });
  const threadId = (opened.json() as { thread_id: string }).thread_id;
  const full = await app.inject({ method: "GET", url: `/api/inbox/threads/${threadId}`, headers: adminHeaders });
  const msgs = (full.json() as { messages: Array<{ author: string }> }).messages;
  assert.equal(msgs[0].author, VAULT);
});

test("unknown recipient is 400", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/inbox/open",
    headers: adminHeaders,
    payload: { to: "ghost", topic: "x", body: "y" },
  });
  assert.equal(res.statusCode, 400);
  assert.equal((res.json() as { code: string }).code, "unknown_recipient");
});
