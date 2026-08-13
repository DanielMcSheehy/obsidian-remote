# Vault API — obsidian.swarmlaboratory.com

Base: `https://obsidian.swarmlaboratory.com`
Auth: `Authorization: Bearer APP_PASSWORD` (APP_PASSWORD=strong)

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

## Health

```bash
curl https://obsidian.swarmlaboratory.com/healthz
curl https://obsidian.swarmlaboratory.com/api/config
```
