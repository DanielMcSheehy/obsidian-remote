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
