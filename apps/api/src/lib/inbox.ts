import { nanoid } from "nanoid";
import {
  BusError,
  VAULT,
  cleanName,
  createBus,
  type Agent,
  type Bus,
  type InboxStore,
  type Message,
  type Thread,
} from "./bus.js";
import { ensureSurreal, surrealQuery, surrealReady } from "./surreal.js";

export { BusError, VAULT, cleanName, createBus, createMemoryStore, screenBody, presentMessage } from "./bus.js";
export type { Agent, Bus, BusEvent, Message, PresentedMessage, PullResult, SendResult, Thread, ThreadView } from "./bus.js";

function firstRow<T>(rows: unknown): T | null {
  const sets = rows as unknown[][];
  const list = (sets?.[0] as T[] | undefined) || [];
  return list[0] || null;
}

function allRows<T>(rows: unknown): T[] {
  const sets = rows as unknown[][];
  return ((sets?.[0] as T[] | undefined) || []).filter(Boolean);
}

function mapThread(r: Record<string, unknown>): Thread {
  const participants = Array.isArray(r.participants) ? r.participants.map((p) => String(p)) : [];
  return {
    id: String(r.key || ""),
    topic: String(r.topic || ""),
    participants,
    status: String(r.status || "open"),
    created_at: String(r.created_at || ""),
    updated_at: String(r.updated_at || ""),
  };
}

function mapMessage(r: Record<string, unknown>): Message {
  const flags = Array.isArray(r.flags) ? r.flags.map((f) => String(f)) : [];
  const read_by = Array.isArray(r.read_by) ? r.read_by.map((x) => String(x)) : [];
  const idem = r.idempotency_key == null ? undefined : String(r.idempotency_key);
  return {
    id: String(r.key || ""),
    thread_id: String(r.thread_key || ""),
    author: String(r.author || ""),
    body: String(r.body || ""),
    held: !!r.held,
    flags,
    read_by,
    idempotency_key: idem || undefined,
    created_at: String(r.created_at || ""),
  };
}

export function createSurrealStore(): InboxStore {
  return {
    available: () => surrealReady(),
    ensure: () => ensureSurreal(),
    async listAgents() {
      const rows = allRows<Agent>(await surrealQuery("SELECT name, created_at FROM agent"));
      return rows
        .filter((a) => a?.name)
        .map((a) => ({ name: a.name, created_at: a.created_at ? String(a.created_at) : undefined }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async registerAgent(name) {
      const clean = cleanName(name);
      if (!clean) throw new BusError("invalid_name", "invalid name");
      const token = `ag_${nanoid(24)}`;
      await surrealQuery(
        "DELETE agent WHERE name = $name; CREATE agent SET name = $name, token = $tok, created_at = time::now()",
        { name: clean, tok: token },
      );
      return { name: clean, token };
    },
    async findAgentByToken(token) {
      const hit = firstRow<Agent>(await surrealQuery("SELECT * FROM agent WHERE token = $tok LIMIT 1", { tok: token }));
      return hit || null;
    },
    async agentExists(name) {
      const hit = firstRow<{ name: string }>(
        await surrealQuery("SELECT name FROM agent WHERE name = $name LIMIT 1", { name }),
      );
      return !!hit?.name;
    },
    async getThread(id) {
      const hit = firstRow<Record<string, unknown>>(
        await surrealQuery("SELECT * FROM inbox_thread WHERE key = $id LIMIT 1", { id }),
      );
      return hit ? mapThread(hit) : null;
    },
    async listThreads(who) {
      const rows = allRows<Record<string, unknown>>(
        await surrealQuery(
          "SELECT * FROM inbox_thread WHERE participants CONTAINS $who ORDER BY updated_at DESC LIMIT 100",
          { who },
        ),
      );
      return rows.map(mapThread);
    },
    async insertThread(t) {
      await surrealQuery(
        "CREATE inbox_thread SET key = $key, topic = $topic, participants = $participants, status = $status, created_at = <datetime>$created_at, updated_at = <datetime>$updated_at",
        {
          key: t.id,
          topic: t.topic,
          participants: t.participants,
          status: t.status,
          created_at: t.created_at,
          updated_at: t.updated_at,
        },
      );
    },
    async touchThread(id, updatedAt) {
      await surrealQuery("UPDATE inbox_thread SET updated_at = <datetime>$updated_at WHERE key = $id", { id, updated_at: updatedAt });
    },
    async insertMessage(m) {
      await surrealQuery(
        "CREATE inbox_msg SET key = $key, thread_key = $thread_key, author = $author, body = $body, held = $held, flags = $flags, read_by = $read_by, idempotency_key = $idempotency_key, created_at = <datetime>$created_at",
        {
          key: m.id,
          thread_key: m.thread_id,
          author: m.author,
          body: m.body,
          held: m.held,
          flags: m.flags,
          read_by: m.read_by,
          idempotency_key: m.idempotency_key ?? null,
          created_at: m.created_at,
        },
      );
    },
    async findMessageByIdem(author, key) {
      const hit = firstRow<Record<string, unknown>>(
        await surrealQuery(
          "SELECT * FROM inbox_msg WHERE author = $author AND idempotency_key = $key LIMIT 1",
          { author, key },
        ),
      );
      return hit ? mapMessage(hit) : null;
    },
    async getMessage(id) {
      const hit = firstRow<Record<string, unknown>>(
        await surrealQuery("SELECT * FROM inbox_msg WHERE key = $id LIMIT 1", { id }),
      );
      return hit ? mapMessage(hit) : null;
    },
    async listMessages(threadId) {
      const rows = allRows<Record<string, unknown>>(
        await surrealQuery("SELECT * FROM inbox_msg WHERE thread_key = $tid ORDER BY created_at ASC LIMIT 300", {
          tid: threadId,
        }),
      );
      return rows.map(mapMessage);
    },
    async markRead(threadId, who) {
      await surrealQuery("UPDATE inbox_msg SET read_by = array::union(read_by, [$who]) WHERE thread_key = $tid", {
        tid: threadId,
        who,
      });
    },
    async release(messageId) {
      await surrealQuery("UPDATE inbox_msg SET held = false WHERE key = $id", { id: messageId });
      const hit = firstRow<Record<string, unknown>>(
        await surrealQuery("SELECT * FROM inbox_msg WHERE key = $id LIMIT 1", { id: messageId }),
      );
      return hit ? mapMessage(hit) : null;
    },
  };
}

let bus: Bus = createBus(createSurrealStore());

export function useBus(next: Bus): void {
  bus = next;
}

export function resetBus(): void {
  bus = createBus(createSurrealStore());
}

export function getBus(): Bus {
  return bus;
}

export function inboxAvailable(): boolean {
  return bus.available();
}

export async function ensureInbox(): Promise<boolean> {
  return bus.ensure();
}

export async function registerAgent(name: string): Promise<Agent> {
  return bus.registerAgent(name);
}

export async function findAgentByToken(token: string): Promise<Agent | null> {
  return bus.findAgentByToken(token);
}

export async function listAgents(): Promise<Array<{ name: string; created_at?: string }>> {
  return bus.listAgents();
}
