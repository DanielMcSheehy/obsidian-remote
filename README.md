# Obsidian Remote — Vault on Coolify (files + LiveSync + graph)

One `docker-compose.yml` → Coolify → Obsidian sync. CouchDB is **internal only** (`expose`, never `ports`), hardcoded credentials. New: **vault files live on `app_data:/data/vault`** — the Coolify instance *is* the vault.

```
Browser / Obsidian + LiveSync ──► Traefik (SERVICE_FQDN_APP) ──► app:3000 (UI + API + /couch proxy)
                                                              ├─► /data/vault (real *.md files)
                                                              └─► couchdb:5984 (internal)
```

## Deploy (limited setup)

**In Coolify:** `New Service → Docker Compose` → point at this repo.

```
APP_PASSWORD=your-strong-password   # gates /api/* and the web UI
VAULT_NAME=obsidian                 # optional, CouchDB vault DB name
```

Leave `APP_PASSWORD` empty for local dev (open). Couch is hardcoded `admin / obsidian-remote-internal-do-not-expose`, only reachable via `app → http://couchdb:5984`.

After `Domains → https://obsidian.yourdomain.com → Save → Redeploy`, wait for `listening on 0.0.0.0:3000` + `default vault ready` + `vault:/data/vault`.

## Use — Web Vault (new)

`https://obsidian.yourdomain.com` → enter `APP_PASSWORD`:

- **File tree** (left) → `notes/hello.md`, create `path/to/note` → `+`, delete `×`
- **Editor** → textarea + `Edit/Preview` toggle (`react-markdown`), `Save (Ctrl+S)` → `PUT /api/files/:path`
- **Graph view** → `Graph view` button → 2D `force-graph` of `[[wikilinks]]` (`GET /api/graph` builds nodes/edges from vault files, click node to open)

Vault is real files on volume `app_data:/data/vault` — survives redeploys. `GET /api/files`, `GET /api/files/content?path=...`, `PUT /api/files/*`, `DELETE /api/files/*` all gated by `APP_PASSWORD`.

## Use — Obsidian LiveSync (still works)

Same single vault `obsidian` DB for replication:

```
URI= https://obsidian.yourdomain.com/couch/obsidian
User= admin
Pass= obsidian-remote-internal-do-not-expose
DB=   obsidian
```

Obsidian → Community Plugins → **Self-hosted LiveSync** → paste 4 fields. Couch handles multi-writer MVCC; vault files (`/data/vault`) are separate from Couch chunks — choose one workflow or keep both (web vault is primary).

## Why hardcoded Couch password is fine

- Couch never touches public internet (`expose` not `ports`).
- Real secret is `APP_PASSWORD` on the proxy.

## Local dev

```bash
npm install
npm run build          # builds web → apps/api/public then api
APP_PASSWORD=secret npm run dev:api
npm run dev:web        # Vite 5173 proxies /api,/couch,/healthz → 3000
```

## API

| Path | Auth | Notes |
|------|------|-------|
| `GET /healthz` | no | Coolify gate |
| `GET /api/health`, `/api/config` | no | |
| `POST /api/auth/login {password}` | no | → `{token}` |
| `GET /api/auth/me` | `Bearer APP_PASSWORD` | |
| `GET /api/vault`, `/api/vault/credentials` | same | LiveSync |
| `GET /api/files` | same | list `/data/vault` |
| `GET /api/files/content?path=` | same | raw md |
| `PUT /api/files/* {content}` | same | create/update |
| `DELETE /api/files/*` | same | delete |
| `GET /api/graph` | same | nodes/edges from `[[wikilinks]]` |
| `* /couch/*` | Couch Basic | proxy → CouchDB |

All `Authorization: Bearer <APP_PASSWORD>` or `X-Auth-Token`.

## How it works

- Boot: `ensureCouchUp(60)` → `PUT /obsidian` vault DB, and `mkdir -p /data/vault`
- Couch `local.ini` baked via `couchdb/Dockerfile`, not `:ro` mount (avoids `chown` fail)
- Frontend served from same `app:3000` via `@fastify/static` + SPA fallback, `force-graph` lazy-loaded
