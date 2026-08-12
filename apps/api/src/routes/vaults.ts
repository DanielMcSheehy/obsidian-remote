import type { FastifyInstance } from "fastify";
import { config } from "../lib/config.js";
import { requireAppPassword } from "../lib/auth.js";
import { createDatabase, setSecurity } from "../lib/couch.js";

function dbNameForDefault(): string {
  // single default vault — hardcoded DB name, no per-user suffix
  return config.defaultVault;
}

export async function vaultRoutes(app: FastifyInstance) {
  // gate /api/vault* behind APP_PASSWORD if set
  app.addHook("preHandler", async (req, reply) => {
    if (req.url.startsWith("/api/vault")) {
      return new Promise<void>((resolve) => requireAppPassword(req as unknown as Parameters<typeof requireAppPassword>[0], reply as unknown as Parameters<typeof requireAppPassword>[1], resolve));
    }
  });

  // single vault info
  app.get("/api/vault", async () => {
    const dbName = dbNameForDefault();
    return { vault: { id: "default", name: dbName, dbName, createdAt: "" }, couchUrl: `${config.publicUrl}/couch/${dbName}`, couchUser: config.couchUser, couchPassword: config.couchPassword };
  });

  // keep legacy plural for backwards compat
  app.get("/api/vaults", async () => {
    const dbName = dbNameForDefault();
    const vault = { id: "default", name: dbName, dbName, ownerId: "default", createdAt: "" };
    return { vaults: [vault] };
  });

  app.get("/api/vault/files", async (req, reply) => {
    const dbName = dbNameForDefault();
    const url = `${config.couchUrl}/${encodeURIComponent(dbName)}/_all_docs?include_docs=false&limit=200`;
    const auth = `Basic ${Buffer.from(`${config.couchUser}:${config.couchPassword}`).toString("base64")}`;
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (r.status === 404) return { dbName, total: 0, files: [] };
    if (!r.ok) return reply.code(500).send({ error: `couch ${r.status}: ${await r.text()}` });
    const j = (await r.json()) as { rows: Array<{ id: string }>; total_rows: number };
    const files = j.rows.filter((row) => !row.id.startsWith("_"));
    return { dbName, total: j.total_rows, files };
  });

  app.get("/api/vaults/:id/files", async (req, reply) => {
    // ignore :id, always default vault
    const dbName = dbNameForDefault();
    const url = `${config.couchUrl}/${encodeURIComponent(dbName)}/_all_docs?include_docs=false&limit=200`;
    const auth = `Basic ${Buffer.from(`${config.couchUser}:${config.couchPassword}`).toString("base64")}`;
    const r = await fetch(url, { headers: { Authorization: auth } });
    if (r.status === 404) return { dbName, total: 0, files: [] };
    if (!r.ok) return reply.code(500).send({ error: `couch ${r.status}: ${await r.text()}` });
    const j = (await r.json()) as { rows: Array<{ id: string }>; total_rows: number };
    const files = j.rows.filter((row) => !row.id.startsWith("_"));
    return { dbName, total: j.total_rows, files };
  });

  // expose credentials for LiveSync — no per-device users, just the internal admin creds
  app.get("/api/vault/credentials", async () => {
    const dbName = dbNameForDefault();
    const couchUrl = `${config.publicUrl}/couch/${dbName}`;
    return {
      couchUrl,
      username: config.couchUser,
      password: config.couchPassword,
      dbName,
      livesync: { couchDB_URI: couchUrl, couchDB_USER: config.couchUser, couchDB_PASSWORD: config.couchPassword, couchDB_DBNAME: dbName },
    };
  });

  app.get("/api/vaults/:id/devices", async () => ({ devices: [] }));
  app.post("/api/vaults/:id/devices", async () => {
    const dbName = dbNameForDefault();
    const couchUrl = `${config.publicUrl}/couch/${dbName}`;
    return { credentials: { couchUrl, username: config.couchUser, password: config.couchPassword, dbName }, livesync: { couchDB_URI: couchUrl, couchDB_USER: config.couchUser, couchDB_PASSWORD: config.couchPassword, couchDB_DBNAME: dbName } };
  });

  // no-op delete for compat
  app.delete("/api/vaults/:id", async () => ({ ok: true }));
  app.delete("/api/vaults/:id/devices/:deviceId", async () => ({ ok: true }));
  app.post("/api/vaults", async () => ({ vault: { id: "default", name: config.defaultVault, dbName: config.defaultVault } }));
}

export async function ensureDefaultVault(app: FastifyInstance): Promise<void> {
  const dbName = dbNameForDefault();
  try {
    await createDatabase(dbName);
    // open to the internal admin user only — proxy handles external auth via APP_PASSWORD
    await setSecurity(dbName, [config.couchUser]);
    app.log.info({ dbName }, "default vault ready");
  } catch (e) {
    app.log.warn(e, "ensure default vault failed");
  }
}
