import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

export type User = { id: string; username: string; passwordHash: string; createdAt: string };
export type Vault = { id: string; name: string; dbName: string; ownerId: string; createdAt: string };
export type Device = { id: string; vaultId: string; name: string; couchUser: string; couchPassword: string; createdAt: string };

type Db = { users: User[]; vaults: Vault[]; devices: Device[] };

function dbPath(): string {
  return path.join(config.dataDir, "app.json");
}

function ensureDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

function load(): Db {
  ensureDir();
  const p = dbPath();
  if (!fs.existsSync(p)) return { users: [], vaults: [], devices: [] };
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return { users: [], vaults: [], devices: [] };
  }
}

function save(db: Db) {
  ensureDir();
  const p = dbPath();
  const tmp = `${p}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, p);
}

export const store = {
  get(): Db {
    return load();
  },
  update(fn: (db: Db) => void): Db {
    const db = load();
    fn(db);
    save(db);
    return db;
  },
  findUserByUsername(username: string): User | undefined {
    return load().users.find((u) => u.username === username);
  },
  findUserById(id: string): User | undefined {
    return load().users.find((u) => u.username === id || u.id === id);
  },
};
