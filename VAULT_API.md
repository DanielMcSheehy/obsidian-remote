# Vault API — obsidian.swarmlaboratory.com

Karpathy LLM wiki on disk: `raw/` (immutable), `wiki/` (agent-owned), `index.md`, `log.md`, `AGENTS.md`.

Base: `https://obsidian.swarmlaboratory.com`
Auth: `Authorization: Bearer APP_PASSWORD` (or `X-Auth-Token`)

Start: `GET /llms.txt` (public) → `GET /api/agent` (auth) → read `index.md`.

## List files + folders

```bash
curl -H "Authorization: Bearer strong" https://obsidian.swarmlaboratory.com/api/files
# → {files:[{path:"notes/hello.md",type:"file"}, {path:"notes",type:"dir"}]}
```

## Read a file

```bash
curl -H "Authorization: Bearer strong" "https://obsidian.swarmlaboratory.com/api/files/content?path=notes/hello.md"
# → {path:"notes/hello.md",content:"# Hello\n[[world]]"}
```

## Create / edit a file

Folders are auto-created from path. Ends with `.md` if you omit it.

```bash
curl -X PUT -H "Authorization: Bearer strong" -H "Content-Type: application/json" \
  -d '{"content":"# My Note\n\nLink to [[world]]"}' \
  https://obsidian.swarmlaboratory.com/api/files/ideas/todo.md
```

Overwrite = same PUT. Link syntax `[[note]]` or `[[path/to/note]]` creates graph edges.

## Delete

```bash
curl -X DELETE -H "Authorization: Bearer strong" https://obsidian.swarmlaboratory.com/api/files/ideas/todo.md
```

Delete a folder: same path to folder (recursive).

## Graph (wikilinks)

```bash
curl -H "Authorization: Bearer strong" https://obsidian.swarmlaboratory.com/api/graph
# → {nodes:[{id:"notes/hello.md"}], edges:[{source:"notes/hello.md",target:"world.md"}]}
```

Nodes = notes, edges = `[[wikilinks]]` parsed from content.

## Search + lint + log (agents)

```bash
curl -H "Authorization: Bearer strong" "https://obsidian.swarmlaboratory.com/api/search?q=welcome"
curl -H "Authorization: Bearer strong" https://obsidian.swarmlaboratory.com/api/lint
curl -X POST -H "Authorization: Bearer strong" -H "Content-Type: application/json" \
  -d '{"kind":"ingest","title":"Paper X","detail":"updated wiki/Topic.md"}' \
  https://obsidian.swarmlaboratory.com/api/log
```

`raw/` and `log.md` reject PUT/DELETE unless `?force=1`.

## Attachments

```bash
# JSON: {name, base64 data-url, path?}  → stored on disk, default raw/assets/
curl -X POST -H "Authorization: Bearer strong" -H "Content-Type: application/json" \
  -d '{"name":"shot.png","base64":"data:image/png;base64,...","path":"raw/assets/shot.png"}' \
  https://obsidian.swarmlaboratory.com/api/files/upload
# embed with ![[raw/assets/shot.png]]
curl -H "Authorization: Bearer strong" \
  "https://obsidian.swarmlaboratory.com/api/files/raw?path=raw/assets/shot.png&token=strong"
```

## MCP

`POST https://obsidian.swarmlaboratory.com/mcp` JSON-RPC (`initialize`, `tools/list`, `tools/call`). Bearer `APP_PASSWORD` (full tools) or agent token (inbox tools only).

## Agent inbox (thread bus, no LLM)

Identity is the bearer token. `from` is never a field. `vault` is the human.

```bash
curl -X POST -H "Authorization: Bearer strong" -H "Content-Type: application/json" \
  -d '{"name":"research"}' https://obsidian.swarmlaboratory.com/api/agents/register
# → {agent:{name,token}}

# human opens a thread (from=vault)
curl -X POST -H "Authorization: Bearer strong" -H "Content-Type: application/json" \
  -d '{"to":"research","topic":"hi","body":"ping"}' \
  https://obsidian.swarmlaboratory.com/api/inbox/open
# → {message_id,thread_id,status:"delivered"}

# agent pulls own inbox
curl -H "Authorization: Bearer <agent-token>" https://obsidian.swarmlaboratory.com/api/inbox?full=1

# agent replies
curl -X POST -H "Authorization: Bearer <agent-token>" -H "Content-Type: application/json" \
  -d '{"body":"pong"}' \
  https://obsidian.swarmlaboratory.com/api/inbox/threads/<thread_id>/reply
```

MCP (agent token or APP_PASSWORD): `inbox_pull`, `thread_reply`, `thread_open`, `agents_list`.
Steering-shaped inbound is stored `held` (body hidden from the agent) until `POST /api/inbox/messages/:id/release`.

## Surreal (file-backed, internal)

Couch stays for LiveSync. Surreal holds graph copies + inbox.

```bash
curl -X POST -H "Authorization: Bearer strong" -H "Content-Type: application/json" \
  -d '{"sql":"SELECT * FROM wiki_node LIMIT 10"}' \
  https://obsidian.swarmlaboratory.com/api/surreal/query
```

## Health

```bash
curl https://obsidian.swarmlaboratory.com/healthz
curl https://obsidian.swarmlaboratory.com/llms.txt
curl https://obsidian.swarmlaboratory.com/api/config
```
