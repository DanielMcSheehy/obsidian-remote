import type { FastifyInstance, FastifyReply } from "fastify";
import fs from "node:fs";
import path from "node:path";
import { requireAppPassword } from "../lib/auth.js";
import { vaultRoot } from "./files.js";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".pdf": "application/pdf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function safePath(p: string): string {
  const decoded = decodeURIComponent(p || "").replace(/\0/g, "");
  const normalized = path.posix
    .normalize(decoded.replace(/\\/g, "/"))
    .replace(/^(\.\.(\/|$))+/, "")
    .replace(/^\/+/, "");
  const root = vaultRoot();
  if (!normalized || normalized === ".") return root;
  const full = path.join(root, normalized);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (full !== root && !full.startsWith(prefix)) throw new Error("invalid path");
  return full;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function listing(rel: string, dir: string): string {
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => !e.name.startsWith("."))
    .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
  const base = rel ? `/view/${rel}` : "/view";
  const parent = rel.includes("/") ? `/view/${rel.slice(0, rel.lastIndexOf("/"))}` : rel ? "/view" : "";
  const rows = entries
    .map((e) => {
      const href = `${base}/${encodeURIComponent(e.name)}`;
      const label = e.isDirectory() ? `${e.name}/` : e.name;
      return `<li><a href="${href}">${esc(label)}</a></li>`;
    })
    .join("");
  const title = esc(rel || "html");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 2rem; font: 16px/1.5 system-ui, sans-serif; background: #0c0a14; color: #f4eefc; }
    a { color: #c4b5fd; }
    h1 { font-weight: 600; letter-spacing: -0.03em; }
    ul { padding-left: 1.2rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${parent ? `<p><a href="${parent}">..</a></p>` : ""}
  <ul>${rows || "<li><em>empty</em></li>"}</ul>
</body>
</html>`;
}

async function sendView(relRaw: string, reply: FastifyReply) {
  const rel = (relRaw || "").replace(/^\/+/, "").replace(/\/+$/, "");
  let full: string;
  try {
    full = safePath(rel);
  } catch {
    return reply.code(400).send({ error: "invalid path" });
  }
  if (!fs.existsSync(full)) return reply.code(404).send({ error: "not found" });
  const stat = fs.statSync(full);
  if (stat.isDirectory()) {
    const index = path.join(full, "index.html");
    if (fs.existsSync(index) && fs.statSync(index).isFile()) {
      full = index;
    } else {
      const html = listing(rel || "html", full);
      return reply.type("text/html; charset=utf-8").header("Cache-Control", "no-store").send(html);
    }
  }
  const ext = path.extname(full).toLowerCase();
  const ctype = TYPES[ext] || "application/octet-stream";
  return reply.type(ctype).header("Cache-Control", "no-store").header("X-Content-Type-Options", "nosniff").send(fs.createReadStream(full));
}

export async function viewRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req, reply) => {
    const u = req.url.split("?")[0];
    if (u === "/view" || u.startsWith("/view/")) {
      return new Promise<void>((resolve) => requireAppPassword(req as unknown as Parameters<typeof requireAppPassword>[0], reply as unknown as Parameters<typeof requireAppPassword>[1], resolve));
    }
  });

  app.get("/view", async (_req, reply) => {
    const htmlDir = path.join(vaultRoot(), "html");
    if (fs.existsSync(htmlDir) && fs.statSync(htmlDir).isDirectory()) {
      return sendView("html", reply);
    }
    return sendView("", reply);
  });

  app.get("/view/*", async (req, reply) => {
    const raw = (req.params as { "*": string })["*"] || "";
    return sendView(raw, reply);
  });
}
