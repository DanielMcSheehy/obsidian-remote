import type { FastifyInstance } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { config } from "../lib/config.js";
import { requireAppPassword } from "../lib/auth.js";
import { isLogPath, isRawPath, rebuildIndex, wantsForce } from "../lib/wiki.js";

const VAULT_ROOT = path.join(config.dataDir, "vault");

const WELCOME_MD = `# Welcome

This host **is** the vault. Every note is a real \`*.md\` file on \`/data/vault\` — not a Couch document dressed up as one.

## Write

- Create \`path/to/note\` in the sidebar
- \`⌘/Ctrl+S\` saves · \`⌘/Ctrl+K\` jumps to any note
- Drag a file onto a folder to move it
- Use the edit toolbar for a quote, code block, link, or image

> Quotes are just markdown. They render like this.

\`\`\`ts
// fenced blocks keep a language label + copy, like reading view
const vault = "/data/vault";
\`\`\`

## Link

Obsidian labels are the \`|\` alias. External links are normal markdown.

- [[Welcome]] — same note
- [[Welcome#Write|the write section]] — alias / label
- [[ideas/spark]] — unresolved until that note exists
- [Obsidian help](https://help.obsidian.md/Links) — external

Images: \`![[photo.png]]\` or \`![](https://…)\`. Embed a note with \`![[Welcome]]\`.

## Graph

Open **Graph** to see every \`[[wikilink]]\` as an edge. Click a node to open it.
`;

export function vaultRoot(): string {
  return VAULT_ROOT;
}

export function ensureVault(): string {
  fs.mkdirSync(VAULT_ROOT, { recursive: true });
  return VAULT_ROOT;
}

export function seedWelcomeIfEmpty(): boolean {
  ensureVault();
  const files = listFiles().filter((f) => f.type === "file" && f.path.endsWith(".md") && f.path !== "AGENTS.md" && f.path !== "log.md" && f.path !== "index.md");
  if (files.length > 0) return false;
  const dest = path.join(VAULT_ROOT, "wiki", "Welcome.md");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, WELCOME_MD, "utf8");
  return true;
}

function safePath(p: string): string {
  const decoded = decodeURIComponent(p || "").replace(/\0/g, "");
  const normalized = path.posix
    .normalize(decoded.replace(/\\/g, "/"))
    .replace(/^(\.\.(\/|$))+/, "")
    .replace(/^\/+/, "");
  if (!normalized || normalized === ".") throw new Error("invalid path");
  const full = path.join(VAULT_ROOT, normalized);
  const root = VAULT_ROOT.endsWith(path.sep) ? VAULT_ROOT : VAULT_ROOT + path.sep;
  if (full !== VAULT_ROOT && !full.startsWith(root)) throw new Error("invalid path");
  return full;
}

function withMd(p: string): string {
  const n = p.replace(/^\/+/, "");
  if (!n) return n;
  if (path.posix.extname(n)) return n;
  return `${n}.md`;
}

function listFiles(base = ""): Array<{ path: string; type: "file" | "dir"; size?: number; mtime?: string }> {
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

/** [[target]], [[target|alias]], [[target#header]], [[target#header|alias]] → target only */
function parseLinks(content: string): string[] {
  const links: string[] = [];
  const stripped = content.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
  const wikilink = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = wikilink.exec(stripped)) !== null) {
    const raw = m[1].trim();
    if (raw) links.push(raw);
  }
  return links;
}

function resolveLink(link: string, nodes: Array<{ id: string; label: string; path: string }>, nodeSet: Set<string>): string {
  let target = link;
  if (!target.endsWith(".md")) target = `${target}.md`;
  if (nodeSet.has(target)) return target;
  const lower = target.toLowerCase();
  const byPath = nodes.find((n) => n.path.toLowerCase() === lower);
  if (byPath) return byPath.id;
  const byLabel = nodes.find((n) => n.label.toLowerCase() === link.toLowerCase());
  if (byLabel) return byLabel.id;
  const byBase = nodes.find((n) => n.path.toLowerCase().endsWith(`/${lower}`));
  if (byBase) return byBase.id;
  return target;
}

export async function filesRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    if (req.url.startsWith("/api/files") || req.url.startsWith("/api/graph")) {
      return new Promise<void>((resolve) => requireAppPassword(req as unknown as Parameters<typeof requireAppPassword>[0], reply as unknown as Parameters<typeof requireAppPassword>[1], resolve));
    }
  });

  // GET /api/files -> list all files
  app.get("/api/files", async () => {
    const files = listFiles();
    return { vault: VAULT_ROOT, files };
  });

  // GET /api/files/content?path=xxx -> raw content
  app.get("/api/files/content", async (req, reply) => {
    const { path: p } = req.query as { path?: string };
    if (!p) return reply.code(400).send({ error: "path query required" });
    let full: string;
    try {
      full = safePath(p);
    } catch {
      return reply.code(400).send({ error: "invalid path" });
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      try {
        const md = safePath(withMd(p));
        if (fs.existsSync(md) && fs.statSync(md).isFile()) {
          return { path: withMd(p), content: fs.readFileSync(md, "utf8") };
        }
      } catch {
        /* ignore */
      }
      return reply.code(404).send({ error: "not found" });
    }
    const content = fs.readFileSync(full, "utf8");
    return { path: p, content };
  });

  // GET /api/files/raw?path= — images / binaries (token query works for <img>)
  app.get("/api/files/raw", async (req, reply) => {
    const { path: p } = req.query as { path?: string };
    if (!p) return reply.code(400).send({ error: "path query required" });
    let full: string;
    try {
      full = safePath(p);
    } catch {
      return reply.code(400).send({ error: "invalid path" });
    }
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return reply.code(404).send({ error: "not found" });
    const ext = path.extname(full).toLowerCase();
    const types: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".bmp": "image/bmp",
      ".ico": "image/x-icon",
      ".pdf": "application/pdf",
    };
    const buf = fs.readFileSync(full);
    return reply.type(types[ext] || "application/octet-stream").send(buf);
  });

  // POST /api/files/upload { path?, name, base64 } — binary attachments on disk
  app.post("/api/files/upload", async (req, reply) => {
    const body = (req.body as { path?: string; name?: string; base64?: string }) ?? {};
    if (!body.base64) return reply.code(400).send({ error: "base64 required" });
    const name = (body.name || "file.bin").replace(/[^a-zA-Z0-9._-]/g, "_");
    let p = (body.path || `raw/assets/${name}`).replace(/^\/+/, "");
    if (!p.includes(".")) p = `${p}${path.posix.extname(name)}`;
    if (isRawPath(p) && !p.startsWith("raw/assets/") && !wantsForce(req.query, req.headers as Record<string, unknown>)) {
      return reply.code(403).send({ error: "protected", hint: "use raw/assets/… or ?force=1" });
    }
    let full: string;
    try {
      full = safePath(p);
    } catch {
      return reply.code(400).send({ error: "invalid path" });
    }
    const b64 = body.base64.replace(/^data:[^;]+;base64,/, "");
    const buf = Buffer.from(b64, "base64");
    if (buf.length > 20 * 1024 * 1024) return reply.code(413).send({ error: "max 20MB" });
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buf);
    return { ok: true, path: p, size: buf.length, embed: `![[${p}]]` };
  });

  // PUT /api/files/:path -> create/update
  app.put("/api/files/*", async (req, reply) => {
    const raw = (req.params as { "*": string })["*"] || "";
    const p = withMd(raw);
    if ((isRawPath(p) || isLogPath(p)) && !wantsForce(req.query, req.headers as Record<string, unknown>)) {
      return reply.code(403).send({ error: "protected", hint: "raw/ and log.md are append-only. Use ?force=1 or POST /api/log" });
    }
    const { content } = (req.body as { content?: string }) ?? {};
    if (content === undefined) return reply.code(400).send({ error: "content required" });
    let full: string;
    try {
      full = safePath(p);
    } catch {
      return reply.code(400).send({ error: "invalid path" });
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
    if (p !== "index.md") {
      try {
        rebuildIndex();
      } catch {
        /* ignore */
      }
    }
    return { ok: true, path: p, size: Buffer.byteLength(content, "utf8") };
  });

  // DELETE /api/files/:path
  app.delete("/api/files/*", async (req, reply) => {
    const p = (req.params as { "*": string })["*"] || "";
    if ((isRawPath(p) || isLogPath(p) || p === "AGENTS.md" || p === "index.md") && !wantsForce(req.query, req.headers as Record<string, unknown>)) {
      return reply.code(403).send({ error: "protected", hint: "schema/raw files need ?force=1" });
    }
    let full: string;
    try {
      full = safePath(p);
    } catch {
      return reply.code(400).send({ error: "invalid path" });
    }
    if (!fs.existsSync(full)) return reply.code(404).send({ error: "not found" });
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      fs.rmSync(full, { recursive: true, force: true });
    } else {
      fs.unlinkSync(full);
    }
    try {
      rebuildIndex();
    } catch {
      /* ignore */
    }
    return { ok: true };
  });

  app.get("/api/graph", async (req) => {
    const { prefix } = (req.query as { prefix?: string }) ?? {};
    return collectGraph(prefix);
  });
}

export function collectGraph(prefix?: string) {
  const files = listFiles().filter((f) => f.type === "file" && f.path.endsWith(".md") && (!prefix || f.path.startsWith(prefix)));
  const nodes: Array<{ id: string; label: string; path: string; folder: string; dangling: boolean; degree: number }> = files.map((f) => ({
    id: f.path,
    label: path.basename(f.path, ".md"),
    path: f.path,
    folder: f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "",
    dangling: false,
    degree: 0,
  }));
  const nodeSet = new Set(nodes.map((n) => n.id));
  const edges: Array<{ source: string; target: string }> = [];
  const seen = new Set<string>();
  for (const f of files) {
    const full = safePath(f.path);
    const content = fs.readFileSync(full, "utf8");
    if (f.path === "AGENTS.md" || f.path === "index.md" || f.path === "log.md") continue;
    const links = parseLinks(content);
    for (const link of links) {
      const resolved = resolveLink(link, nodes, nodeSet);
      const key = `${f.path}\0${resolved}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: f.path, target: resolved });
    }
  }
  for (const e of edges) {
    if (!nodeSet.has(e.target)) {
      nodes.push({
        id: e.target,
        label: path.basename(e.target, ".md"),
        path: e.target,
        folder: e.target.includes("/") ? e.target.slice(0, e.target.lastIndexOf("/")) : "",
        dangling: true,
        degree: 0,
      });
      nodeSet.add(e.target);
    }
  }
  for (const e of edges) {
    const s = nodes.find((n) => n.id === e.source);
    const t = nodes.find((n) => n.id === e.target);
    if (s) s.degree += 1;
    if (t) t.degree += 1;
  }
  return { nodes, edges, vault: VAULT_ROOT };
}
