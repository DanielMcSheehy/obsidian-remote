import type { FastifyInstance } from "fastify";
import { config } from "../lib/config.js";
import { searchVault, lintVault, appendLog } from "../lib/wiki.js";
import { collectGraph } from "./files.js";
import { listMail, sendMail, findAgentByToken } from "../lib/inbox.js";
import { ensureSurreal, surrealQuery, surrealReady } from "../lib/surreal.js";
import fs from "node:fs";
import path from "node:path";

type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };

function vaultDir(): string {
  return path.join(config.dataDir, "vault");
}

function readFileRel(rel: string): string {
  const full = path.join(vaultDir(), rel.replace(/^\/+/, ""));
  if (!full.startsWith(vaultDir())) throw new Error("invalid path");
  return fs.readFileSync(full, "utf8");
}

function writeFileRel(rel: string, content: string): void {
  const p = rel.replace(/^\/+/, "");
  if (p.startsWith("raw/") || p === "log.md") throw new Error("protected path — use force via HTTP");
  const full = path.join(vaultDir(), p);
  if (!full.startsWith(vaultDir())) throw new Error("invalid path");
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

const TOOLS = [
  { name: "vault_list", description: "List vault files", inputSchema: { type: "object", properties: {} } },
  { name: "vault_read", description: "Read a vault file", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "vault_write", description: "Write a wiki/ note", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "vault_search", description: "Search markdown", inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] } },
  { name: "vault_graph", description: "Wikilink graph", inputSchema: { type: "object", properties: {} } },
  { name: "vault_lint", description: "Orphans and dangling links", inputSchema: { type: "object", properties: {} } },
  { name: "vault_log", description: "Append to log.md", inputSchema: { type: "object", properties: { kind: { type: "string" }, title: { type: "string" }, detail: { type: "string" } }, required: ["title"] } },
  { name: "inbox_list", description: "List mail for an agent (admin)", inputSchema: { type: "object", properties: { agent: { type: "string" } }, required: ["agent"] } },
  { name: "inbox_send", description: "Send mail to a registered agent", inputSchema: { type: "object", properties: { to: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, required: ["to", "subject"] } },
  { name: "surreal_query", description: "Run SurrealQL (read-oriented)", inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "vault_list": {
      const walk = (dir: string, rel: string, out: string[]) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          if (e.name.startsWith(".")) continue;
          const r = rel ? `${rel}/${e.name}` : e.name;
          if (e.isDirectory()) walk(path.join(dir, e.name), r, out);
          else out.push(r);
        }
      };
      const files: string[] = [];
      walk(vaultDir(), "", files);
      return { files };
    }
    case "vault_read":
      return { path: args.path, content: readFileRel(String(args.path)) };
    case "vault_write":
      writeFileRel(String(args.path), String(args.content ?? ""));
      return { ok: true, path: args.path };
    case "vault_search":
      return { hits: searchVault(String(args.q || "")) };
    case "vault_graph":
      return collectGraph();
    case "vault_lint":
      return lintVault(collectGraph());
    case "vault_log":
      return { line: appendLog(String(args.kind || "write"), String(args.title), String(args.detail || "")) };
    case "inbox_list":
      if (!(await ensureSurreal())) throw new Error("surreal unavailable");
      return { mail: await listMail(String(args.agent)) };
    case "inbox_send":
      if (!(await ensureSurreal())) throw new Error("surreal unavailable");
      await sendMail({ to: String(args.to), from: "mcp", subject: String(args.subject), body: String(args.body || "") });
      return { ok: true };
    case "surreal_query":
      if (!(await ensureSurreal())) throw new Error("surreal unavailable");
      return { result: await surrealQuery(String(args.sql)) };
    default:
      throw new Error(`unknown tool ${name}`);
  }
}

function ok(id: Rpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}
function err(id: Rpc["id"], message: string, code = -32000) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export async function mcpRoutes(app: FastifyInstance) {
  app.get("/mcp", async (req, reply) => {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") || String(req.headers["x-auth-token"] || "");
    if (config.appPassword && token !== config.appPassword) {
      const ag = surrealReady() ? await findAgentByToken(token).catch(() => null) : null;
      if (!ag) return reply.code(401).send({ error: "unauthorized" });
    }
    return {
      name: "obsidian-remote",
      version: "0.2.0",
      transport: "streamable-http",
      endpoint: "/mcp",
      tools: TOOLS.map((t) => t.name),
    };
  });

  app.post("/mcp", async (req, reply) => {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "") || String(req.headers["x-auth-token"] || "");
    if (config.appPassword && token !== config.appPassword) {
      return reply.code(401).send({ error: "unauthorized", hint: "Bearer APP_PASSWORD" });
    }
    const body = req.body as Rpc;
    if (!body || typeof body !== "object") return reply.send(err(null, "invalid request", -32600));
    const { id, method, params } = body;
    try {
      if (method === "initialize") {
        return reply.send(ok(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "obsidian-remote", version: "0.2.0" },
        }));
      }
      if (method === "notifications/initialized" || method === "ping") return reply.send(ok(id, {}));
      if (method === "tools/list") return reply.send(ok(id, { tools: TOOLS }));
      if (method === "tools/call") {
        const name = String(params?.name || "");
        const args = (params?.arguments as Record<string, unknown>) || {};
        const result = await callTool(name, args);
        return reply.send(ok(id, { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }));
      }
      return reply.send(err(id, `unknown method ${method}`, -32601));
    } catch (e) {
      return reply.send(err(id, String(e)));
    }
  });
}
