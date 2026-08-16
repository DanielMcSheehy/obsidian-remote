import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

const VAULT = path.join(config.dataDir, "vault");

export const AGENTS_MD = `# Agent schema — Karpathy LLM wiki

This host **is** the vault. Markdown on \`/data/vault\`. You write files; the human browses them.

## Layers

- \`raw/\` — immutable sources. Never PUT/DELETE unless the human sets \`?force=1\`.
- \`wiki/\` — pages you own. Entity pages, concepts, comparisons, synthesis.
- \`html/\` — live sites. Full HTML + CSS + JS. Preview at \`GET /view/html/…\`.
- \`AGENTS.md\` — this file. Co-evolve conventions here.
- \`index.md\` — catalog. Auto-rebuilt on every write. Read it first.
- \`log.md\` — append-only timeline. Use \`POST /api/log\`, do not overwrite.

## Wikilinks

\`[[wiki/Welcome]]\`, \`[[wiki/Welcome|label]]\`, \`[[wiki/Welcome#Heading]]\`.
Those edges power \`GET /api/graph\` and \`GET /api/lint\`.

## Workflows

**Ingest.** Drop the source into \`raw/\` (human or \`?force=1\`). Read it. Discuss takeaways if a human is present. Write or update pages under \`wiki/\` with \`[[wikilinks]]\`. \`POST /api/log\` with \`kind=ingest\`.

**Query.** \`GET /api/search?q=\` then read the hits. Answer with citations (\`[[wiki/…]]\`). File a good answer as a new wiki page. \`POST /api/log\` with \`kind=query\`.

**Lint.** \`GET /api/lint\` — orphans, dangling links, empty pages. Fix missing \`[[links]]\` and missing pages. \`POST /api/log\` with \`kind=lint\`.

## Rules

- Do not rewrite \`raw/\`.
- Every wiki claim that came from a source should link to it: \`[[raw/…]]\` or a markdown link.
- Prefer updating an existing page over creating a near-duplicate.
- New notes without a folder go under \`wiki/\`.
- Live pages go under \`html/\` as \`.html\` / \`.css\` / \`.js\`. They render at \`/view/html/…\` (scripts run in a sandbox; relative assets resolve).
`;

const WELCOME = `# Welcome

This vault follows the **Karpathy LLM wiki** pattern.

- \`wiki/\` — compiled pages (you read these)
- \`raw/\` — source documents (do not edit)
- \`html/\` — live HTML/CSS/JS (preview in the vault, or open \`/view/html/…\`)
- \`index.md\` — catalog; agents read this first
- \`log.md\` — what happened
- \`AGENTS.md\` — how agents must behave

Create \`wiki/path/to/note\`, link with \`[[wiki/Welcome|a label]]\`, ask an agent to ingest into \`raw/\`.
Drop a full page in \`html/hello/index.html\` with \`style.css\` + \`app.js\` beside it.
`;

const HELLO_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hello from the vault</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <p class="eyebrow">html/hello</p>
    <h1>Live HTML</h1>
    <p>This page is a real file. Scripts and CSS next to it load through <code>/view/html/hello/</code>.</p>
    <button id="go" type="button">click me</button>
    <p id="out"></p>
  </main>
  <script src="app.js"></script>
</body>
</html>
`;

const HELLO_CSS = `:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: Outfit, Inter, system-ui, sans-serif;
  background:
    radial-gradient(ellipse 70% 50% at 10% -10%, rgba(139, 92, 246, 0.4), transparent 58%),
    #0c0a14;
  color: #f4eefc;
}
main { max-width: 28rem; padding: 2rem; }
.eyebrow {
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.72rem;
  color: #c4b5fd;
}
h1 { font-weight: 650; letter-spacing: -0.04em; margin: 0.2em 0 0.4em; }
button {
  border: 0;
  border-radius: 999px;
  padding: 0.65rem 1.2rem;
  font: inherit;
  color: #0c0a14;
  background: linear-gradient(120deg, #a78bfa, #f472b6);
  cursor: pointer;
}
#out { min-height: 1.4em; color: #c4b5fd; }
`;

const HELLO_JS = `const out = document.getElementById("out");
const go = document.getElementById("go");
let n = 0;
go?.addEventListener("click", () => {
  n += 1;
  if (out) out.textContent = n === 1 ? "scripts run in this sandbox." : \`clicked \${n} times\`;
});
`;

function root(): string {
  fs.mkdirSync(VAULT, { recursive: true });
  return VAULT;
}

function full(rel: string): string {
  return path.join(root(), rel);
}

function writeIfMissing(rel: string, content: string): boolean {
  const p = full(rel);
  if (fs.existsSync(p)) return false;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  return true;
}

export function isRawPath(p: string): boolean {
  const n = p.replace(/^\/+/, "");
  return n === "raw" || n.startsWith("raw/");
}

export function isLogPath(p: string): boolean {
  return p.replace(/^\/+/, "") === "log.md";
}

export function isLayoutRoot(p: string): boolean {
  const n = p.replace(/^\/+/, "").replace(/\/+$/, "");
  return n === "raw" || n === "wiki" || n === "html" || n === "AGENTS.md" || n === "index.md" || n === "log.md";
}

export function wantsForce(q: unknown, headers: Record<string, unknown>): boolean {
  const rec = (q || {}) as Record<string, string | undefined>;
  const h = (headers["x-vault-force"] as string | undefined) || "";
  return rec.force === "1" || rec.force === "true" || h === "1" || h === "true";
}

export type MdFile = { path: string; content: string };

const TEXT_EXT = /\.(md|html?|css|js|mjs|json|txt)$/i;

export function listMarkdown(): MdFile[] {
  return listTextFiles().filter((f) => f.path.endsWith(".md"));
}

export function listTextFiles(): MdFile[] {
  const out: MdFile[] = [];
  const walk = (dir: string, rel: string) => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f, r);
      else if (e.isFile() && TEXT_EXT.test(e.name)) {
        out.push({ path: r, content: fs.readFileSync(f, "utf8") });
      }
    }
  };
  walk(root(), "");
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function listHtmlPages(): { path: string }[] {
  return listTextFiles()
    .filter((f) => /\.html?$/i.test(f.path))
    .map((f) => ({ path: f.path }));
}

function oneLiner(content: string): string {
  const lines = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").split(/\r?\n/);
  const heading = lines.find((l) => /^#\s+/.test(l))?.replace(/^#\s+/, "").trim();
  const body = lines.find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("```"));
  const bit = (body || heading || "").replace(/\s+/g, " ").trim();
  return bit.length > 140 ? `${bit.slice(0, 137)}…` : bit;
}

export function buildIndexMarkdown(): string {
  const files = listMarkdown().filter((f) => f.path !== "index.md");
  const groups: Record<string, MdFile[]> = { wiki: [], raw: [], html: [], schema: [], other: [] };
  for (const f of files) {
    if (f.path.startsWith("wiki/")) groups.wiki.push(f);
    else if (f.path.startsWith("raw/")) groups.raw.push(f);
    else if (f.path.startsWith("html/")) groups.html.push(f);
    else if (f.path === "AGENTS.md" || f.path === "log.md") groups.schema.push(f);
    else groups.other.push(f);
  }
  for (const page of listHtmlPages()) {
    if (groups.html.some((f) => f.path === page.path)) continue;
    groups.html.push({ path: page.path, content: "" });
  }
  const section = (title: string, rows: MdFile[]) => {
    const lines = [`## ${title}`, ""];
    if (rows.length === 0) lines.push("_empty_", "");
    else {
      for (const r of rows) {
        const link = r.path.replace(/\.md$/i, "");
        const sum = oneLiner(r.content);
        lines.push(sum ? `- [[${link}]] — ${sum}` : `- [[${link}]]`);
      }
      lines.push("");
    }
    return lines.join("\n");
  };
  return [
    "# Wiki index",
    "",
    "Auto-generated catalog. Agents: read this first, then drill into pages.",
    "",
    section("wiki", groups.wiki),
    section("raw", groups.raw),
    section("html", groups.html),
    section("schema", groups.schema),
    section("other", groups.other),
  ].join("\n");
}

export function rebuildIndex(): void {
  fs.writeFileSync(full("index.md"), buildIndexMarkdown(), "utf8");
}

export function appendLog(kind: string, title: string, detail = ""): string {
  const stamp = new Date().toISOString();
  const head = `## [${stamp}] ${kind} | ${title}`;
  const block = detail.trim() ? `${head}\n${detail.trim()}\n\n` : `${head}\n\n`;
  const p = full("log.md");
  if (!fs.existsSync(p)) fs.writeFileSync(p, "# Log\n\n", "utf8");
  fs.appendFileSync(p, block, "utf8");
  return head;
}

export function ensureWikiLayout(): { seeded: boolean; created: string[] } {
  root();
  fs.mkdirSync(full("raw"), { recursive: true });
  fs.mkdirSync(full("wiki"), { recursive: true });
  fs.mkdirSync(full("html"), { recursive: true });
  const created: string[] = [];
  if (writeIfMissing("AGENTS.md", AGENTS_MD)) created.push("AGENTS.md");
  if (writeIfMissing("log.md", "# Log\n\n")) created.push("log.md");
  const mdCount = listMarkdown().filter((f) => f.path !== "AGENTS.md" && f.path !== "log.md" && f.path !== "index.md").length;
  let seeded = false;
  if (mdCount === 0 && writeIfMissing("wiki/Welcome.md", WELCOME)) {
    created.push("wiki/Welcome.md");
    seeded = true;
    appendLog("seed", "Welcome", "wiki/Welcome.md");
  }
  if (listHtmlPages().length === 0) {
    if (writeIfMissing("html/hello/index.html", HELLO_HTML)) created.push("html/hello/index.html");
    if (writeIfMissing("html/hello/style.css", HELLO_CSS)) created.push("html/hello/style.css");
    if (writeIfMissing("html/hello/app.js", HELLO_JS)) created.push("html/hello/app.js");
    if (created.some((c) => c.startsWith("html/hello/"))) {
      seeded = true;
      appendLog("seed", "html/hello", "live HTML sandbox at /view/html/hello/");
    }
  }
  rebuildIndex();
  if (!created.includes("index.md") && !fs.existsSync(full("index.md"))) created.push("index.md");
  return { seeded, created };
}

export type SearchHit = { path: string; line: number; text: string; score: number };

export function searchVault(q: string, limit = 30): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  for (const f of listTextFiles()) {
    if (f.path.toLowerCase().includes(needle)) {
      hits.push({ path: f.path, line: 0, text: f.path, score: 40 });
    }
    const lines = f.content.split(/\r?\n/);
    lines.forEach((text, i) => {
      const idx = text.toLowerCase().indexOf(needle);
      if (idx < 0) return;
      const score = 10 + (i === 0 ? 8 : 0) + Math.max(0, 8 - idx / 8);
      hits.push({ path: f.path, line: i + 1, text: text.trim().slice(0, 220), score });
    });
  }
  hits.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const h of hits) {
    const k = `${h.path}:${h.line}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(h);
    if (out.length >= limit) break;
  }
  return out;
}

export type LintReport = {
  orphans: string[];
  dangling: string[];
  empty: string[];
  wikiNotes: number;
};

export function lintVault(graph: { nodes: Array<{ id: string; dangling?: boolean }>; edges: Array<{ source: string; target: string }> }): LintReport {
  const skip = new Set(["index.md", "log.md", "AGENTS.md"]);
  const inbound = new Set<string>();
  for (const e of graph.edges) inbound.add(e.target);
  const orphans = graph.nodes
    .filter((n) => !n.dangling && !skip.has(n.id) && !inbound.has(n.id) && n.id.startsWith("wiki/"))
    .map((n) => n.id);
  const dangling = graph.nodes.filter((n) => n.dangling).map((n) => n.id);
  const empty = listMarkdown()
    .filter((f) => !skip.has(f.path) && f.content.replace(/^#.*$/m, "").trim().length < 8)
    .map((f) => f.path);
  const wikiNotes = listMarkdown().filter((f) => f.path.startsWith("wiki/")).length;
  return { orphans, dangling, empty, wikiNotes };
}
