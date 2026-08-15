import type { FastifyInstance } from "fastify";
import { requireAppPassword } from "../lib/auth.js";
import { describeSchema, ensureSurreal, surrealQuery, surrealReady } from "../lib/surreal.js";

export async function surrealRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (req.url.split("?")[0].startsWith("/api/surreal")) {
      return new Promise<void>((resolve) => requireAppPassword(req as unknown as Parameters<typeof requireAppPassword>[0], reply as unknown as Parameters<typeof requireAppPassword>[1], resolve));
    }
  });

  app.get("/api/surreal/health", async () => ({ ok: await ensureSurreal() }));

  app.get("/api/surreal/schema", async () => ({ tables: await describeSchema() }));

  app.post("/api/surreal/query", async (req, reply) => {
    if (!surrealReady() && !(await ensureSurreal())) return reply.code(503).send({ error: "surreal unavailable" });
    const { sql, vars } = (req.body as { sql?: string; vars?: Record<string, unknown> }) ?? {};
    if (!sql || typeof sql !== "string") return reply.code(400).send({ error: "sql required" });
    if (sql.length > 20_000) return reply.code(400).send({ error: "sql too long" });
    try {
      const result = await surrealQuery(sql, vars);
      return { ok: true, result };
    } catch (e) {
      return reply.code(400).send({ error: String(e) });
    }
  });
}
