import { nanoid } from "nanoid";
import { surrealQuery, surrealReady } from "./surreal.js";

export type Agent = { name: string; token: string; created_at?: string };
export type Mail = {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  read: boolean;
  thread: string;
  created_at: string;
};

export function threadKey(subject: string, a: string, b: string): string {
  const sub = subject.replace(/^\s*(re|fwd)\s*:\s*/i, "").trim().toLowerCase() || "untitled";
  const pair = [a, b].map((s) => s.toLowerCase()).sort().join("|");
  return `${pair}::${sub}`.slice(0, 120);
}

function recId(row: { id?: unknown }): string {
  const id = row.id as { toString?: () => string } | string | undefined;
  return typeof id === "string" ? id : id?.toString?.() || "";
}

export async function registerAgent(name: string): Promise<Agent> {
  const clean = name.toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 40);
  if (!clean) throw new Error("invalid name");
  const token = `ag_${nanoid(24)}`;
  await surrealQuery(
    "DELETE agent WHERE name = $name; CREATE agent SET name = $name, token = $token, created_at = time::now()",
    { name: clean, token },
  );
  return { name: clean, token };
}

export async function findAgentByToken(token: string): Promise<Agent | null> {
  const rows = (await surrealQuery("SELECT * FROM agent WHERE token = $token LIMIT 1", { token })) as unknown[][];
  const hit = (rows?.[0] as Agent[] | undefined)?.[0];
  return hit || null;
}

export async function listAgents(): Promise<Array<{ name: string; created_at?: string }>> {
  const rows = (await surrealQuery("SELECT name, created_at FROM agent")) as unknown[][];
  return ((rows?.[0] as Agent[]) || []).map((a) => ({ name: a.name, created_at: String(a.created_at || "") }));
}

export async function sendMail(msg: { to: string; from: string; subject: string; body: string; thread?: string }): Promise<Mail> {
  const thread = msg.thread || threadKey(msg.subject, msg.to, msg.from);
  const rows = (await surrealQuery(
    "CREATE mail SET to = $to, from = $from, subject = $subject, body = $body, thread = $thread, read = false, created_at = time::now()",
    { ...msg, thread },
  )) as unknown[][];
  const r = ((rows?.[0] as Record<string, unknown>[]) || [])[0] || {};
  return {
    id: recId(r),
    to: msg.to,
    from: msg.from,
    subject: msg.subject,
    body: msg.body,
    read: false,
    thread,
    created_at: String(r.created_at || new Date().toISOString()),
  };
}

function mapMail(r: Record<string, unknown>): Mail {
  const to = String(r.to || "");
  const from = String(r.from || "");
  const subject = String(r.subject || "");
  return {
    id: recId(r),
    to,
    from,
    subject,
    body: String(r.body || ""),
    read: !!r.read,
    thread: String(r.thread || threadKey(subject, to, from)),
    created_at: String(r.created_at || ""),
  };
}

export async function listMail(box: string, unreadOnly = false): Promise<Mail[]> {
  const sql = unreadOnly
    ? "SELECT * FROM mail WHERE (to = $box OR from = $box) AND read = false ORDER BY created_at ASC LIMIT 300"
    : "SELECT * FROM mail WHERE to = $box OR from = $box ORDER BY created_at ASC LIMIT 300";
  const rows = (await surrealQuery(sql, { box })) as unknown[][];
  return ((rows?.[0] as Record<string, unknown>[]) || []).map(mapMail);
}

export async function markThreadRead(thread: string, box: string): Promise<void> {
  await surrealQuery("UPDATE mail SET read = true WHERE thread = $thread AND to = $box", { thread, box });
}

export async function markRead(id: string, to?: string): Promise<void> {
  if (to) await surrealQuery("UPDATE type::thing('mail', $id) SET read = true WHERE to = $to", { id: id.replace(/^mail:/, ""), to });
  else await surrealQuery("UPDATE type::record($id) SET read = true", { id });
}

export function inboxAvailable(): boolean {
  return surrealReady();
}
