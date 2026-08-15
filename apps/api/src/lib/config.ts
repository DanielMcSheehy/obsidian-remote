import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function env(name: string, fallback?: string) {
  return process.env[name] ?? fallback ?? "";
}

function resolveDataDir(): string {
  const requested = env("DATA_DIR", "/data");
  try {
    fs.mkdirSync(requested, { recursive: true });
    fs.accessSync(requested, fs.constants.W_OK);
    return requested;
  } catch {
    const fallback = path.join(process.cwd(), ".data");
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

// Couch is NOT externally exposed — internal docker network only.
// Hardcode is fine; override via env if you really want to.
const HARDCODED_COUCH_USER = "admin";
const HARDCODED_COUCH_PASS = "obsidian-remote-internal-do-not-expose";

function ensureAppPassword(): string {
  // Single password that gates /api/* and the UI.
  // Set APP_PASSWORD (or AUTH_PASSWORD) in Coolify env. Empty = no auth (dev).
  const v = env("APP_PASSWORD", "") || env("AUTH_PASSWORD", "") || env("SYNC_PASSWORD", "");
  if (v) return v;
  // fallback to JWT_SECRET for backwards compat if someone set that
  const legacy = env("JWT_SECRET", "");
  if (legacy && legacy.length >= 8) return legacy;
  return "";
}

export const config = {
  port: parseInt(env("PORT", "3000"), 10),
  host: "0.0.0.0",
  couchUrl: env("COUCHDB_URL", "http://couchdb:5984"),
  couchUser: env("COUCHDB_USER", HARDCODED_COUCH_USER),
  couchPassword: env("COUCHDB_PASSWORD", HARDCODED_COUCH_PASS),
  // if user didn't set COUCHDB_PASSWORD, use hardcoded above
  dataDir: resolveDataDir(),
  appPassword: ensureAppPassword(),
  // keep jwtSecret for token signing if needed, but appPassword is the gate
  jwtSecret: env("JWT_SECRET", "") || ensureAppPassword() || crypto.randomBytes(16).toString("hex"),
  defaultVault: env("VAULT_NAME", "obsidian").toLowerCase().replace(/[^a-z0-9_-]/g, "-").slice(0, 32) || "obsidian",
  publicUrl: env("PUBLIC_URL", "") || env("SERVICE_FQDN_APP", "") || `http://localhost:${env("PORT", "3000")}`,
  nodeEnv: env("NODE_ENV", "production"),
  surrealUrl: env("SURREAL_URL", "http://surreal:8000"),
  surrealUser: env("SURREAL_USER", "root"),
  surrealPassword: env("SURREAL_PASSWORD", HARDCODED_COUCH_PASS),
  surrealNs: env("SURREAL_NS", "vault"),
  surrealDb: env("SURREAL_DB", "memory"),
};

export function couchAdminAuthHeader(): string {
  const token = Buffer.from(`${config.couchUser}:${config.couchPassword}`).toString("base64");
  return `Basic ${token}`;
}
