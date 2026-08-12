import { config, couchAdminAuthHeader } from "./config.js";

async function couchFetch(p: string, init: RequestInit = {}): Promise<Response> {
  const url = `${config.couchUrl}${p}`;
  const headers: Record<string, string> = {
    Authorization: couchAdminAuthHeader(),
    ...(init.headers as Record<string, string> | undefined),
  };
  return fetch(url, { ...init, headers });
}

export async function ensureCouchUp(retries = 30): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await couchFetch("/_up");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("CouchDB not reachable after retries");
}

export async function createDatabase(dbName: string): Promise<void> {
  const r = await couchFetch(`/${encodeURIComponent(dbName)}`, { method: "PUT" });
  if (r.ok || r.status === 412) return; // 412 already exists
  const body = await r.text();
  throw new Error(`create db ${dbName} failed ${r.status}: ${body}`);
}

export async function setSecurity(dbName: string, members: string[]): Promise<void> {
  const sec = {
    admins: { names: [], roles: [] },
    members: { names: members, roles: [] },
  };
  const r = await couchFetch(`/${encodeURIComponent(dbName)}/_security`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sec),
  });
  if (!r.ok) throw new Error(`set _security failed ${r.status}: ${await r.text()}`);
}

export async function createCouchUser(username: string, password: string, roles: string[] = []): Promise<void> {
  const id = `org.couchdb.user:${username}`;
  const doc: Record<string, unknown> = {
    _id: id,
    name: username,
    password,
    roles,
    type: "user",
  };
  // try PUT with rev handling
  const existing = await couchFetch(`/_users/${encodeURIComponent(id)}`);
  if (existing.ok) {
    const j = (await existing.json()) as { _rev: string };
    (doc as { _rev: string })._rev = j._rev;
  }
  const r = await couchFetch(`/_users/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(doc),
  });
  if (!r.ok) throw new Error(`create couch user failed ${r.status}: ${await r.text()}`);
}

export async function deleteCouchUser(username: string): Promise<void> {
  const id = `org.couchdb.user:${username}`;
  const r = await couchFetch(`/_users/${encodeURIComponent(id)}`);
  if (r.status === 404) return;
  if (!r.ok) throw new Error(`get couch user failed ${r.status}`);
  const j = (await r.json()) as { _rev: string };
  const del = await couchFetch(`/_users/${encodeURIComponent(id)}?rev=${encodeURIComponent(j._rev)}`, { method: "DELETE" });
  if (!del.ok && del.status !== 404) throw new Error(`delete couch user failed ${del.status}: ${await del.text()}`);
}

export async function getDbSecurity(dbName: string): Promise<{ members: { names: string[] } }> {
  const r = await couchFetch(`/${encodeURIComponent(dbName)}/_security`);
  if (!r.ok) throw new Error(`get _security failed ${r.status}`);
  return (await r.json()) as { members: { names: string[] } };
}
