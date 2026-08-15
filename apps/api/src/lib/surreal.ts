import { Surreal } from "surrealdb";
import { config } from "./config.js";

let client: Surreal | null = null;
let ready = false;

const SCHEMA = `
DEFINE NAMESPACE IF NOT EXISTS ${config.surrealNs};
USE NS ${config.surrealNs} DB ${config.surrealDb};
DEFINE DATABASE IF NOT EXISTS ${config.surrealDb};
DEFINE TABLE IF NOT EXISTS agent SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS name ON agent TYPE string;
DEFINE FIELD IF NOT EXISTS token ON agent TYPE string;
DEFINE FIELD IF NOT EXISTS created_at ON agent TYPE datetime;
DEFINE INDEX IF NOT EXISTS agent_name ON agent FIELDS name UNIQUE;
DEFINE TABLE IF NOT EXISTS mail SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS to ON mail TYPE string;
DEFINE FIELD IF NOT EXISTS from ON mail TYPE string;
DEFINE FIELD IF NOT EXISTS subject ON mail TYPE string;
DEFINE FIELD IF NOT EXISTS body ON mail TYPE string;
DEFINE FIELD IF NOT EXISTS read ON mail TYPE bool;
DEFINE FIELD IF NOT EXISTS created_at ON mail TYPE datetime;
DEFINE FIELD IF NOT EXISTS thread ON mail TYPE string;
DEFINE TABLE IF NOT EXISTS wiki_node SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS path ON wiki_node TYPE string;
DEFINE FIELD IF NOT EXISTS title ON wiki_node TYPE string;
DEFINE FIELD IF NOT EXISTS updated_at ON wiki_node TYPE datetime;
DEFINE INDEX IF NOT EXISTS wiki_path ON wiki_node FIELDS path UNIQUE;
DEFINE TABLE IF NOT EXISTS wiki_edge SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS source ON wiki_edge TYPE string;
DEFINE FIELD IF NOT EXISTS target ON wiki_edge TYPE string;
`;

export function surrealReady(): boolean {
  return ready;
}

export async function getSurreal(): Promise<Surreal> {
  if (client && ready) return client;
  const db = new Surreal();
  const url = config.surrealUrl.replace(/\/$/, "");
  await db.connect(url, {
    namespace: config.surrealNs,
    database: config.surrealDb,
    authentication: { username: config.surrealUser, password: config.surrealPassword },
  });
  client = db;
  ready = true;
  return db;
}

export async function ensureSurreal(): Promise<boolean> {
  try {
    const db = await getSurreal();
    await db.query(SCHEMA);
    return true;
  } catch {
    ready = false;
    client = null;
    return false;
  }
}

export async function surrealQuery(sql: string, vars?: Record<string, unknown>): Promise<unknown> {
  const db = await getSurreal();
  return db.query(sql, vars);
}

export type SchemaField = { name: string; type: string };
export type SchemaIndex = { name: string; def?: string };
export type SchemaTable = { name: string; fields: SchemaField[]; indexes?: SchemaIndex[] };

export const FALLBACK_SCHEMA: SchemaTable[] = [
  {
    name: "agent",
    fields: [{ name: "name", type: "string" }, { name: "token", type: "string" }, { name: "created_at", type: "datetime" }],
    indexes: [{ name: "agent_name", def: "UNIQUE name" }],
  },
  {
    name: "mail",
    fields: [
      { name: "to", type: "string" },
      { name: "from", type: "string" },
      { name: "subject", type: "string" },
      { name: "body", type: "string" },
      { name: "read", type: "bool" },
      { name: "thread", type: "string" },
      { name: "created_at", type: "datetime" },
    ],
  },
  {
    name: "wiki_node",
    fields: [{ name: "path", type: "string" }, { name: "title", type: "string" }, { name: "updated_at", type: "datetime" }],
    indexes: [{ name: "wiki_path", def: "UNIQUE path" }],
  },
  { name: "wiki_edge", fields: [{ name: "source", type: "string" }, { name: "target", type: "string" }] },
];

function unwrap(result: unknown): unknown {
  let cur: unknown = result;
  for (let i = 0; i < 4; i++) {
    if (Array.isArray(cur) && cur.length === 1) cur = cur[0];
    else break;
  }
  return cur;
}

export async function describeSchema(): Promise<SchemaTable[]> {
  if (!ready) {
    const ok = await Promise.race([ensureSurreal(), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 600))]);
    if (!ok) return FALLBACK_SCHEMA;
  }
  try {
    const raw = unwrap(await surrealQuery("INFO FOR DB"));
    const tablesObj = (raw as { tables?: Record<string, string> })?.tables || {};
    const names = Object.keys(tablesObj);
    if (names.length === 0) return FALLBACK_SCHEMA;
    const out: SchemaTable[] = [];
    for (const name of names.sort()) {
      const info = unwrap(await surrealQuery(`INFO FOR TABLE ${name}`)) as { fields?: Record<string, string>; indexes?: Record<string, string> };
      const fields = Object.entries(info?.fields || {}).map(([fname, def]) => {
        const type = String(def).match(/TYPE\s+([^\s]+)/i)?.[1] || String(def).slice(0, 40);
        return { name: fname, type };
      });
      const indexes = Object.entries(info?.indexes || {}).map(([iname, def]) => ({
        name: iname,
        def: String(def).replace(/^DEFINE INDEX\s+\S+\s+ON\s+\S+\s+/i, "").slice(0, 80),
      }));
      const fallback = FALLBACK_SCHEMA.find((t) => t.name === name);
      out.push({
        name,
        fields: fields.length ? fields : fallback?.fields || [],
        indexes: indexes.length ? indexes : fallback?.indexes || [],
      });
    }
    return out;
  } catch {
    return FALLBACK_SCHEMA;
  }
}

export async function syncWikiGraph(nodes: Array<{ id: string; label: string }>, edges: Array<{ source: string; target: string }>): Promise<void> {
  if (!ready) return;
  try {
    const db = await getSurreal();
    await db.query("DELETE wiki_node; DELETE wiki_edge;");
    for (const n of nodes.slice(0, 400)) {
      await db.query("CREATE wiki_node SET path = $path, title = $title, updated_at = time::now()", { path: n.id, title: n.label });
    }
    for (const e of edges.slice(0, 800)) {
      await db.query("CREATE wiki_edge SET source = $s, target = $t", { s: e.source, t: e.target });
    }
  } catch {
    /* optional */
  }
}
