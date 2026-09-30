import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify from "fastify";
import { config } from "../lib/config.js";
import { createBus, createMemoryStore, resetBus, useBus, VAULT } from "../lib/inbox.js";
import { mcpRoutes } from "./mcp.js";

const app = Fastify();
const adminToken = config.appPassword || undefined;
let agentToken = "";

type Rpc = { result?: { content?: Array<{ text?: string }> }; error?: { message: string } };

before(async () => {
  const b = createBus(createMemoryStore());
  const agent = await b.registerAgent("research");
  agentToken = agent.token;
  useBus(b);
  await mcpRoutes(app);
  await app.ready();
});

after(async () => {
  await app.close();
  resetBus();
});

async function call(name: string, args: Record<string, unknown>, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await app.inject({
    method: "POST",
    url: "/mcp",
    headers,
    payload: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
  });
  return { status: res.statusCode, body: res.json() as Rpc };
}

function parsed(rpc: Rpc): unknown {
  const text = rpc.result?.content?.[0]?.text;
  assert.ok(text);
  return JSON.parse(text);
}

test("admin MCP opens as vault, not mcp", async () => {
  const res = await call("thread_open", { to: "research", topic: "job", body: "go" }, adminToken);
  assert.equal(res.status, 200);
  const out = parsed(res.body) as { thread_id: string; status: string };
  assert.equal(out.status, "delivered");
  const pull = await call("inbox_pull", { unread: true }, agentToken);
  const box = parsed(pull.body) as { self: string; threads: Array<{ messages: Array<{ author: string }> }> };
  assert.equal(box.self, "research");
  assert.equal(box.threads[0].messages[0].author, VAULT);
});

test("agent token cannot call vault_write", async () => {
  const res = await call("vault_write", { path: "wiki/x.md", content: "nope" }, agentToken);
  assert.equal(res.status, 200);
  assert.match(res.body.error?.message || "", /APP_PASSWORD/);
});

test("agent reply stays on the same thread", async () => {
  const opened = await call("thread_open", { to: "research", topic: "two", body: "q" }, adminToken);
  const threadId = (parsed(opened.body) as { thread_id: string }).thread_id;
  const replied = await call("thread_reply", { thread_id: threadId, body: "a" }, agentToken);
  const out = parsed(replied.body) as { thread_id: string };
  assert.equal(out.thread_id, threadId);
});

test("inbox_list and inbox_send are gone", async () => {
  const list = await call("inbox_list", { agent: "research" }, adminToken);
  assert.match(list.body.error?.message || "", /unknown tool/);
  const send = await call("inbox_send", { to: "research", subject: "x", body: "y" }, adminToken);
  assert.match(send.body.error?.message || "", /unknown tool/);
});
