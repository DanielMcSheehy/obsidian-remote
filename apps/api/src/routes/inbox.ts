import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../lib/config.js";
import { requireAppPassword } from "../lib/auth.js";
import {
  BusError,
  VAULT,
  ensureInbox,
  findAgentByToken,
  getBus,
  listAgents,
  registerAgent,
} from "../lib/inbox.js";

function bearer(req: { headers: Record<string, unknown> }): string {
  const h = String(req.headers.authorization || "").trim();
  const t = h.startsWith("Bearer ") ? h.slice(7) : h;
  return t || String(req.headers["x-auth-token"] || "");
}

export async function asAgentOrAdmin(req: { headers: Record<string, unknown> }): Promise<{ admin: boolean; agent: string | null }> {
  const token = bearer(req);
  if (token) {
    const ag = await findAgentByToken(token);
    if (ag) return { admin: false, agent: ag.name };
  }
  if (config.appPassword && token === config.appPassword) return { admin: true, agent: null };
  if (!config.appPassword) return { admin: true, agent: null };
  return { admin: false, agent: null };
}

function actorOf(who: { admin: boolean; agent: string | null }): string | null {
  if (who.admin) return VAULT;
  return who.agent;
}

async function sendBusError(reply: FastifyReply, e: unknown) {
  if (e instanceof BusError) return reply.code(e.status).send({ error: e.message, code: e.code });
  return reply.code(500).send({ error: String(e) });
}

export async function inboxRoutes(app: FastifyInstance) {
  app.post("/api/agents/register", { preHandler: [requireAppPassword] }, async (req, reply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const { name } = (req.body as { name?: string }) ?? {};
    if (!name) return reply.code(400).send({ error: "name required" });
    try {
      const agent = await registerAgent(name);
      return { ok: true, agent, hint: "Store agent.token. Use Authorization: Bearer <token> on /api/inbox" };
    } catch (e) {
      return sendBusError(reply, e);
    }
  });

  app.get("/api/agents", async (req, reply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const who = await asAgentOrAdmin(req);
    if (!who.admin && !who.agent) return reply.code(401).send({ error: "unauthorized", hint: "Bearer APP_PASSWORD or a registered agent token" });
    return { agents: await listAgents(), self: who.agent || VAULT, admin: who.admin };
  });

  app.get("/api/inbox", async (req, reply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const who = await asAgentOrAdmin(req);
    if (!who.admin && !who.agent) return reply.code(401).send({ error: "unauthorized" });
    const q = req.query as { agent?: string; unread?: string; full?: string };
    const box = who.admin ? q.agent || VAULT : who.agent!;
    try {
      return await getBus().pull(box, { unreadOnly: q.unread === "1", includeMessages: q.full === "1" });
    } catch (e) {
      return sendBusError(reply, e);
    }
  });

  app.get("/api/inbox/threads/:id", async (req, reply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const who = await asAgentOrAdmin(req);
    if (!who.admin && !who.agent) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const q = req.query as { agent?: string };
    const viewer = who.admin ? q.agent || VAULT : who.agent!;
    try {
      return await getBus().getThread(viewer, id, { markRead: true });
    } catch (e) {
      return sendBusError(reply, e);
    }
  });

  app.post("/api/inbox/open", async (req, reply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const who = await asAgentOrAdmin(req);
    const from = actorOf(who);
    if (!from) return reply.code(401).send({ error: "unauthorized" });
    const body = (req.body as { to?: string; topic?: string; body?: string; idempotency_key?: string }) ?? {};
    try {
      const sent = await getBus().open(from, {
        to: body.to || "",
        topic: body.topic || "",
        body: body.body || "",
        idempotency_key: body.idempotency_key,
      });
      return { ok: true, ...sent };
    } catch (e) {
      return sendBusError(reply, e);
    }
  });

  app.post("/api/inbox/threads/:id/reply", async (req, reply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const who = await asAgentOrAdmin(req);
    const from = actorOf(who);
    if (!from) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const body = (req.body as { body?: string; idempotency_key?: string }) ?? {};
    try {
      const sent = await getBus().reply(from, id, { body: body.body || "", idempotency_key: body.idempotency_key });
      return { ok: true, ...sent };
    } catch (e) {
      return sendBusError(reply, e);
    }
  });

  app.post("/api/inbox/threads/:id/read", async (req, reply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const who = await asAgentOrAdmin(req);
    const viewer = actorOf(who);
    if (!viewer) return reply.code(401).send({ error: "unauthorized" });
    const { id } = req.params as { id: string };
    const q = req.body as { agent?: string } | undefined;
    const box = who.admin ? q?.agent || VAULT : viewer;
    try {
      await getBus().markRead(box, id);
      return { ok: true };
    } catch (e) {
      return sendBusError(reply, e);
    }
  });

  app.post("/api/inbox/messages/:id/release", async (req, reply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const who = await asAgentOrAdmin(req);
    if (!who.admin) return reply.code(403).send({ error: "admin only", code: "admin_only" });
    const { id } = req.params as { id: string };
    try {
      const sent = await getBus().release(id);
      return { ok: true, ...sent };
    } catch (e) {
      return sendBusError(reply, e);
    }
  });

  app.get("/api/inbox/events", async (req: FastifyRequest, reply: FastifyReply) => {
    if (!(await ensureInbox())) return reply.code(503).send({ error: "inbox unavailable" });
    const who = await asAgentOrAdmin(req);
    if (!who.admin && !who.agent) return reply.code(401).send({ error: "unauthorized" });
    const q = req.query as { agent?: string };
    const sub = who.admin ? q.agent || "*" : who.agent!;
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });
    reply.raw.write(": ok\n\n");
    const unsub = getBus().subscribe(sub, (ev) => {
      reply.raw.write(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`);
    });
    const iv = setInterval(() => {
      reply.raw.write(": ping\n\n");
    }, 15000);
    req.raw.on("close", () => {
      unsub();
      clearInterval(iv);
    });
  });
}
