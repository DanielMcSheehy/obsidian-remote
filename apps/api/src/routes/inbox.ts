import type { FastifyInstance } from "fastify";
import { config } from "../lib/config.js";
import { requireAppPassword } from "../lib/auth.js";
import { findAgentByToken, listAgents, listMail, markRead, markThreadRead, registerAgent, sendMail } from "../lib/inbox.js";
import { ensureSurreal, surrealReady } from "../lib/surreal.js";

function bearer(req: { headers: Record<string, unknown> }): string {
  const h = String(req.headers.authorization || "").trim();
  const t = h.startsWith("Bearer ") ? h.slice(7) : h;
  return t || String(req.headers["x-auth-token"] || "");
}

async function asAgentOrAdmin(req: { headers: Record<string, unknown> }): Promise<{ admin: boolean; agent: string | null }> {
  const token = bearer(req);
  if (config.appPassword && token === config.appPassword) return { admin: true, agent: null };
  if (!config.appPassword && !token) return { admin: true, agent: null };
  if (!surrealReady()) return { admin: false, agent: null };
  const ag = await findAgentByToken(token);
  return { admin: false, agent: ag?.name || null };
}

export async function inboxRoutes(app: FastifyInstance) {
  app.post("/api/agents/register", { preHandler: [requireAppPassword] }, async (req, reply) => {
    if (!(await ensureSurreal())) return reply.code(503).send({ error: "surreal unavailable" });
    const { name } = (req.body as { name?: string }) ?? {};
    if (!name) return reply.code(400).send({ error: "name required" });
    try {
      const agent = await registerAgent(name);
      return { ok: true, agent, hint: "Store agent.token. Use Authorization: Bearer <token> on /api/inbox" };
    } catch (e) {
      return reply.code(400).send({ error: String(e) });
    }
  });

  app.get("/api/agents", async (req, reply) => {
    if (!(await ensureSurreal())) return reply.code(503).send({ error: "surreal unavailable" });
    const who = await asAgentOrAdmin(req);
    if (!who.admin && !who.agent) return reply.code(401).send({ error: "unauthorized", hint: "Bearer APP_PASSWORD or a registered agent token" });
    return { agents: await listAgents(), self: who.agent, admin: who.admin };
  });

  app.get("/api/inbox", async (req, reply) => {
    if (!(await ensureSurreal())) return reply.code(503).send({ error: "surreal unavailable" });
    const who = await asAgentOrAdmin(req);
    const q = req.query as { agent?: string; unread?: string };
    const box = who.admin ? q.agent || "" : who.agent || "";
    if (!who.admin && !who.agent) return reply.code(401).send({ error: "unauthorized" });
    if (!box) return { mail: [], hint: "pass ?agent=name as admin" };
    return { mail: await listMail(box, q.unread === "1"), agent: box };
  });

  app.post("/api/inbox", async (req, reply) => {
    if (!(await ensureSurreal())) return reply.code(503).send({ error: "surreal unavailable" });
    const who = await asAgentOrAdmin(req);
    if (!who.admin && !who.agent) return reply.code(401).send({ error: "unauthorized" });
    const body = (req.body as { to?: string; subject?: string; body?: string; from?: string; thread?: string }) ?? {};
    if (!body.to || !body.subject) return reply.code(400).send({ error: "to and subject required" });
    const from = who.admin ? body.from || "vault" : who.agent!;
    const mail = await sendMail({ to: body.to, from, subject: body.subject, body: body.body || "", thread: body.thread });
    return { ok: true, mail };
  });

  app.post("/api/inbox/read", async (req, reply) => {
    if (!(await ensureSurreal())) return reply.code(503).send({ error: "surreal unavailable" });
    const who = await asAgentOrAdmin(req);
    if (!who.admin && !who.agent) return reply.code(401).send({ error: "unauthorized" });
    const { id, thread } = (req.body as { id?: string; thread?: string }) ?? {};
    const box = who.admin ? (req.body as { agent?: string })?.agent : who.agent || undefined;
    if (thread && box) {
      await markThreadRead(thread, box);
      return { ok: true };
    }
    if (!id) return reply.code(400).send({ error: "id or thread required" });
    await markRead(id, who.admin ? undefined : who.agent || undefined);
    return { ok: true };
  });
}
