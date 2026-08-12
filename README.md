# Obsidian Remote — Self-hosted LiveSync on Coolify (single-vault, zero external Couch)

One `docker-compose.yml` → Coolify → Obsidian sync. CouchDB is **internal only** (docker `expose`, never `ports`), hardcoded credentials.

```
Obsidian + LiveSync ──► Traefik (SERVICE_FQDN_APP) ──► app:3000 (UI + API + /couch proxy)
                                                       │
                                                       └─► couchdb:5984 (internal network only)
```

## Deploy (limited setup)

**In Coolify:** `New Service → Docker Compose` → point at this repo.

**Environment** — only one variable matters:

```
APP_PASSWORD=your-strong-password   # gates /api/* and the web UI
# optional
VAULT_NAME=obsidian                 # default vault DB name (single vault)
```

That's it. Leave `APP_PASSWORD` empty for local dev (open mode). In production set it once — re-deploy logs show `auth=password-set`.

Couch is hardcoded inside compose, not exposed to the internet:

```
COUCHDB_USER=admin
COUCHDB_PASSWORD=obsidian-remote-internal-do-not-expose
```

`app:3000` is the only exposed port (`expose: ["3000"]` + `SERVICE_FQDN_APP`). Coolify's Traefik routes `https://obsidian.yourdomain.com → app:3000`. Couch is reachable only as `app → http://couchdb:5984` on the internal bridge.

After deploy, set `Domains → https://obsidian.yourdomain.com → Save → Redeploy` and wait for `Deployments → Logs` to show `listening on 0.0.0.0:3000` and `default vault ready`. Verify:

```
https://obsidian.yourdomain.com/healthz           → {"status":"ok"}
https://obsidian.yourdomain.com/api/config        → {"defaultVault":"obsidian","hasPassword":true}
```

## Use

1. Open `https://obsidian.yourdomain.com` → enter `APP_PASSWORD` → dashboard shows single vault `obsidian`.
2. Copy the **LiveSync credentials** (same for every device):
   ```
   URI      = https://obsidian.yourdomain.com/couch/obsidian
   Username = admin
   Password = obsidian-remote-internal-do-not-expose
   Database = obsidian
   ```
3. In Obsidian → Community Plugins → **Self-hosted LiveSync** → paste those 4 fields → enable `Live Sync`.
4. Repeat on phone/laptop with identical URI/user/pass/db — CouchDB MVCC handles multi-writer sync and conflicts.

## Why hardcoded Couch password is fine

- Couch never touches the public internet (`expose` not `ports`). Only `app` can reach `couchdb:5984`.
- The *real* secret is `APP_PASSWORD` on the proxy. Changing `APP_PASSWORD` locks the UI/API; LiveSync still uses the internal Couch creds via `https://.../couch/...`.
- If you want to rotate Couch creds, change both places in `docker-compose.yml` and redeploy — then update LiveSync on each device.

## Local dev

```bash
npm install
npm run build          # builds web → apps/api/public then api
APP_PASSWORD=secret npm run dev:api  # or omit APP_PASSWORD for open mode
# in another shell
npm run dev:web        # Vite 5173 proxies /api,/couch,/healthz → 3000
```

Without CouchDB, `/healthz` + `/api/*` still work; `default vault ready` will retry in background.

## API

| Path | Auth | Notes |
|------|------|-------|
| `GET /healthz` | no | Coolify gate |
| `GET /api/health`, `/api/config` | no | |
| `POST /api/auth/login {password}` | no | → `{token}` (token is the password) |
| `GET /api/auth/me` | `Bearer APP_PASSWORD` | |
| `GET /api/vault` | `Bearer APP_PASSWORD` if set | single vault |
| `GET /api/vault/credentials` | same | LiveSync 4 fields |
| `GET /api/vault/files` | same | `_all_docs` |
| `* /couch/*` | Couch Basic | proxy → CouchDB (websocket:true for `_changes?feed=continuous`) |

All `Authorization: Bearer <APP_PASSWORD>` or `X-Auth-Token: <APP_PASSWORD>` accepted.

## How it works

- Boot: `ensureCouchUp(60)` then `PUT /obsidian` + `PUT /obsidian/_security{admin}` auto-creates the single vault.
- Couch `local.ini` baked in: CORS `app://obsidian.md` + `capacitor://localhost`, `max_document_size 50MB`, `max_http_request_size 4GB` for LiveSync chunk attachments.
- Frontend served from same `app:3000` via `@fastify/static` + SPA fallback.
