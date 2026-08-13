import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { config } from "../lib/config.js";
import { requireAppPassword } from "../lib/auth.js";

const VAULT_ROOT = path.join(config.dataDir, "vault");

function ensureVault() {
  fs.mkdirSync(VAULT_ROOT, { recursive: true });
}

function safePath(p: string): string {
  const decoded = decodeURIComponent(p || "");
  // strip leading slash, prevent .. traversal
  const normalized = path.normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "").replace(/^\/+/, "");
  const full = path.join(VAULT_ROOT, normalized);
  if (!full.startsWith(VAULT_ROOT)) throw new Error("invalid path");
  return full;
}

function listFiles(dir: string, base = ""): Array<{ path: string; type: "file" | "dir"; size?: number; mtime?: string }> {
  ensureVault();
  const abs = path.join(VAULT_ROOT, base);
  if (!fs.existsSync(abs)) return [];
  const out: Array<{ path: string; type: "file" | "dir"; size?: number; mtime?: string }> = [];
  const walk = (cur: string, rel: string) => {
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      const full = path.join(cur, e.name);
      const stat = fs.statSync(full);
      if (e.isDirectory()) {
        out.push({ path: relPath, type: "dir", mtime: stat.mtime.toISOString() });
        walk(full, relPath);
      } else if (e.isFile()) {
        out.push({ path: relPath, type: "file", size: stat.size, mtime: stat.mtime.toISOString() });
      }
    }
  };
  walk(abs, base);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function parseLinks(content: string): string[] {
  const links: string[] = [];
  const wikilink = /\[\[([^\]|#]+)(?:#[^\]]*)?(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikilink.exec(content)) !== null) {
    const raw = m[1].trim();
    if (raw) links.push(raw);
  }
  return links;
}

export async function filesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (req.url.startsWith("/api/files") || req.url.startsWith("/api/graph")) {
      return new Promise<void>((resolve) => requireAppPassword(req as unknown as Parameters<typeof requireAppPassword>[0], reply as unknown as Parameters<typeof requireAppPassword>[1], resolve));
    }
  });

  // GET /api/files -> list all files
  app.get("/api/files", async () => {
    const files = listFiles(VAULT_ROOT);
    return { vault: VAULT_ROOT, files };
  });

  // GET /api/files/content?path=xxx -> raw content
  app.get("/api/files/content", async (req, reply) => {
    const { path: p } = req.query as { path?: string };
    if (!p) return reply.code(400).send({ error: "path query required" });
    const full = safePath(p);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return reply.code(404).send({ error: "not found" });
    const content = fs.readFileSync(full, "utf8");
    return { path: p, content };
  });

  // PUT /api/files/:path -> create/update
  app.put("/api/files/*", async (req, reply) => {
    const p = (req.params as { "*": string })["*"] || "";
    const { content } = (req.body as { content?: string }) ?? {};
    if (content === undefined) return reply.code(400).send({ error: "content required" });
    const full = safePath(p);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
    return { ok: true, path: p, size: Buffer.byteLength(content, "utf8") };
  });

  // DELETE /api/files/:path
  app.delete("/api/files/*", async (req, reply) => {
    const p = (req.params as { "*": string })["*"] || "";
    const full = safePath(p);
    if (!fs.existsSync(full)) return reply.code(404).send({ error: "not found" });
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
    } else {
      fs.unlinkSync(full);
    }
    return { ok: true };
  });

  // GET /api/graph -> nodes + edges from wikilinks
  app.get("/api/graph", async () => {
    const files = listFiles(VAULT_ROOT).filter((f) => f.type === "file" && f.path.endsWith(".md"));
    const nodes = files.map((f) => ({ id: f.path, label: path.basename(f.path, ".md"), path: f.path }));
    const nodeSet = new Set(nodes.map((n) => n.id));
    // also add target nodes that don't exist yet (dangling)
    const edges: Array<{ source: string; target: string }> = [];
    const allIds = new Set<string>(nodes.map((n) => n.id));
    for (const f of files) {
      const full = safePath(f.path);
      const content = fs.readFileSync(full, "utf8");
      const links = parseLinks(content);
      for (const link of links) {
        // resolve link: if link contains /, use as is, else try .md
        let target = link;
        if (!target.endsWith(".md")) target = `${target}.md`;
        // if exact match not found, try case-insensitive or basename match
        let resolved: string | undefined;
        if (nodeSet.has(target)) resolved = target;
        else {
          // find by basename
          const cand = nodes.find((n) => n.path.toLowerCase() === target.toLowerCase() || n.label.toLowerCase() === link.toLowerCase());
          resolved = cand?.id;
          if (!resolved) {
            // dangling node, still create
            allIds.add(target);
          }
        }
        if (resolved) edges.push({ source: f.path, target: resolved });
        else edges.push({ source: f.path, target });
      }
    }
    // collect dangling nodes
    for (const e of edges) {
      if (!nodeSet.has(e.target)) {
        nodes.push({ id: e.target, label: path.basename(e.target, ".md"), path: e.target });
        nodeSet.add(e.target);
      }
    }
    return { nodes, edges, vault: VAULT_ROOT };
  });
}
