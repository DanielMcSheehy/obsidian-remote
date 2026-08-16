import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import httpProxy from "@fastify/http-proxy";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { config } from "./lib/config.js";
import { ensureCouchUp } from "./lib/couch.js";
import { authRoutes } from "./routes/auth.js";
import { ensureDefaultVault, vaultRoutes } from "./routes/vaults.js";
import { filesRoutes, ensureVault, vaultRoot, collectGraph } from "./routes/files.js";
import { viewRoutes } from "./routes/view.js";
import { wikiRoutes } from "./routes/wiki.js";
import { ensureWikiLayout } from "./lib/wiki.js";
import { surrealRoutes } from "./routes/surreal.js";
import { inboxRoutes } from "./routes/inbox.js";
import { mcpRoutes } from "./routes/mcp.js";
import { ensureSurreal, syncWikiGraph } from "./lib/surreal.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  const app = Fastify({ logger: true, trustProxy: true });
  // Fastify 5 rejects empty application/json bodies. Drag/delete send that header.
  app.addHook("onRequest", async (req) => {
    const m = req.method;
    if ((m === "GET" || m === "DELETE" || m === "HEAD" || m === "OPTIONS") && req.headers["content-type"]?.includes("application/json")) {
      delete req.headers["content-type"];
    }
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Auth-Token", "Accept", "Origin"],
  });

  // health — unauthenticated, required for Coolify rollout gate
  app.get("/healthz", async () => ({ status: "ok", uptime: process.uptime(), timestamp: Date.now() }));
  app.get("/api/health", async () => ({ status: "ok", couchUrl: config.couchUrl, publicUrl: config.publicUrl, hasPassword: !!config.appPassword, defaultVault: config.defaultVault, surrealUrl: config.surrealUrl }));
  app.get("/api/config", async () => ({ publicUrl: config.publicUrl, couchPrefix: "/couch", defaultVault: config.defaultVault, hasPassword: !!config.appPassword, wiki: true, mcp: "/mcp", surreal: true, inbox: true, html: true, view: "/view" }));
  app.get("/llms.txt", async (_req, reply) => {
    const body = [
      "# Obsidian Remote",
      "",
      "This host is a markdown vault using the Karpathy LLM wiki pattern.",
      "Auth: Authorization: Bearer APP_PASSWORD  (or X-Auth-Token)",
      "",
      "Start: GET /api/agent",
      "Catalog: GET /api/files/content?path=index.md",
      "Schema: GET /api/files/content?path=AGENTS.md",
      "Search: GET /api/search?q=",
      "Lint: GET /api/lint",
      "Write: PUT /api/files/wiki/Page.md  {\"content\":\"...\"}",
      "Log: POST /api/log  {\"kind\":\"ingest\",\"title\":\"...\"}",
      "MCP: POST /mcp  (JSON-RPC, Bearer APP_PASSWORD)",
      "Inbox: POST /api/agents/register {name} → token",
      "Agents: GET /api/agents  (APP_PASSWORD or agent token; names only)",
      "Mail: GET/POST /api/inbox  then POST /api/inbox/read",
      "Surreal: POST /api/surreal/query  {\"sql\":\"...\"}",
      "Upload: POST /api/files/upload  {\"name\",\"base64\",\"path?\"}",
      "HTML: PUT /api/files/html/page.html  {\"content\":\"<!DOCTYPE html>…\"}",
      "View: GET /view/html/page.html  (cookie vault_view, Bearer, or ?token=)",
      "Folder: POST /api/files/mkdir {\"path\":\"wiki/folder\"}",
      "Move: POST /api/files/move {\"from\":\"wiki/a.md\",\"to\":\"wiki/folder\"}",
      "",
      "raw/ is immutable. wiki/ is yours. html/ is live. Read index.md first.",
      "",
    ].join("\n");
    return reply.type("text/plain; charset=utf-8").send(body);
  });

  await authRoutes(app);
  await vaultRoutes(app);
  await filesRoutes(app);
  await viewRoutes(app);
  await wikiRoutes(app);
  await surrealRoutes(app);
  await inboxRoutes(app);
  await mcpRoutes(app);
  // CouchDB proxy — forwards whatever Basic/AuthSession LiveSync sends directly to Couch.
  // Couch itself is NOT exposed externally — only via this proxy on the internal docker network.
  await app.register(httpProxy, {
    upstream: config.couchUrl,
    prefix: "/couch",
    rewritePrefix: "",
    websocket: true,
    http2: false,
  });

  // static frontend
  const candidates = [
    path.join(__dirname, "../public"),
    path.join(__dirname, "../../web/dist"),
    path.join(process.cwd(), "apps/api/public"),
    path.join(process.cwd(), "apps/web/dist"),
  ];
  const publicDir = candidates.find((p) => fs.existsSync(p) && fs.existsSync(path.join(p, "index.html")));
  if (publicDir) {
    app.log.info({ publicDir }, "serving frontend");
    await app.register(fastifyStatic, { root: publicDir, prefix: "/", wildcard: false, decorateReply: true });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/") || req.url.startsWith("/couch/") || req.url.startsWith("/healthz") || req.url.startsWith("/llms.txt") || req.url.startsWith("/mcp") || req.url.startsWith("/view")) {
        return reply.code(404).send({ error: "not found" });
      }
      if (req.method !== "GET") return reply.code(404).send({ error: "not found" });
      return reply.sendFile("index.html");
    });
  } else {
    app.log.warn({ candidates }, "no frontend build found");
    app.setNotFoundHandler((req, reply) => reply.code(404).send({ error: "not found" }));
  }

  return app;
}

const app = await build();

ensureVault();
const layout = ensureWikiLayout();
app.log.info({ vault: vaultRoot(), ...layout }, `vault:${vaultRoot()}`);

ensureCouchUp(60)
  .then(async () => {
    app.log.info("couchdb reachable");
    await ensureDefaultVault(app);
  })
  .catch((e) => app.log.warn(e, "couchdb not reachable yet"));

ensureSurreal()
  .then((ok) => {
    app.log.info({ ok }, ok ? "surreal ready" : "surreal not reachable yet");
    if (ok) {
      try {
        const g = collectGraph();
        void syncWikiGraph(g.nodes, g.edges);
      } catch {
        /* optional */
      }
    }
  })
  .catch((e) => app.log.warn(e, "surreal not reachable yet"));

await app.listen({ port: config.port, host: config.host });
app.log.info(`obsidian-remote listening on ${config.host}:${config.port} publicUrl=${config.publicUrl} defaultVault=${config.defaultVault} auth=${config.appPassword ? "password-set" : "open"} vault:${vaultRoot()}`);
