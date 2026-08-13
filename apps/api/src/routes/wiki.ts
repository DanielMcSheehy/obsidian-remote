import type { FastifyInstance } from "fastify";
import { requireAppPassword } from "../lib/auth.js";
import { appendLog, lintVault, rebuildIndex, searchVault } from "../lib/wiki.js";
import { collectGraph } from "./files.js";

export async function wikiRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    const u = req.url.split("?")[0];
    if (u.startsWith("/api/search") || u.startsWith("/api/lint") || u.startsWith("/api/log") || u.startsWith("/api/wiki") || u.startsWith("/api/agent")) {
      return new Promise<void>((resolve) => requireAppPassword(req as unknown as Parameters<typeof requireAppPassword>[0], reply as unknown as Parameters<typeof requireAppPassword>[1], resolve));
    }
  });

  app.get("/api/search", async (req) => {
    const { q, limit } = req.query as { q?: string; limit?: string };
    const hits = searchVault(q || "", Math.min(80, parseInt(limit || "30", 10) || 30));
    return { q: q || "", hits, total: hits.length };
  });

  app.get("/api/lint", async () => {
    const graph = collectGraph();
    return { ...lintVault(graph), vault: graph.vault };
  });

  app.post("/api/log", async (req, reply) => {
    const body = (req.body as { kind?: string; title?: string; detail?: string }) ?? {};
    if (!body.title) return reply.code(400).send({ error: "title required" });
    const kind = (body.kind || "write").replace(/[^a-z0-9_-]/gi, "").slice(0, 24) || "write";
    const line = appendLog(kind, body.title.slice(0, 200), body.detail || "");
    return { ok: true, line };
  });

  app.post("/api/wiki/reindex", async () => {
    rebuildIndex();
    return { ok: true };
  });

  app.get("/api/agent", async () => ({
    pattern: "karpathy-llm-wiki",
    layout: ["raw/", "wiki/", "AGENTS.md", "index.md", "log.md"],
    endpoints: {
      list: "GET /api/files",
      read: "GET /api/files/content?path=",
      write: "PUT /api/files/:path {content}",
      delete: "DELETE /api/files/:path",
      search: "GET /api/search?q=",
      graph: "GET /api/graph",
      lint: "GET /api/lint",
      log: "POST /api/log {kind,title,detail}",
      reindex: "POST /api/wiki/reindex",
      schema: "GET /api/files/content?path=AGENTS.md",
      index: "GET /api/files/content?path=index.md",
    },
    rules: [
      "Read index.md first",
      "Never rewrite raw/ without ?force=1",
      "Append history via POST /api/log",
      "Wikilink with [[wiki/Page]] so the graph stays true",
    ],
  }));
}
