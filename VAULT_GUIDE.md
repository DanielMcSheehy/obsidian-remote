# Vault Guide — Obsidian Remote

Public: `https://obsidian.swarmlaboratory.com` — login with `APP_PASSWORD`.

## Add a file

1. Left sidebar → `new note → path/to/note` → `+`
2. Example: type `ideas/todo` → creates `ideas/todo.md`
3. Auto adds `# todo` header.

## Add a folder

No separate button — folders are implied by path.
- Create `projects/alpha` → makes folder `projects/` + file `projects/alpha.md`
- Create `projects/beta` → same folder, second file

## Edit a file

1. Click file in left list.
2. Type in editor (monospace).
3. `Save` or `Ctrl+S`. Unsaved shows orange dot.

## Preview

Click `Preview` tab → rendered markdown. `Edit` to go back.

## Link notes

Use `[[wikilinks]]` anywhere:

```md
# Hello
See [[world]] and [[ideas/todo]]
```

Links can be `[[path/to/note]]` or just `[[note]]` (matches by name).

Save → graph updates.

## See the graph

Top bar → `Graph` button.

- Dots = notes
- Lines = `[[wikilinks]]`
- Click a dot → opens that note

Search box filters file list; graph shows filtered state after refresh.

## Delete

Hover file → `×` → confirm.

## Tips

- All files live on Coolify at `/data/vault` — survives redeploys.
- CouchDB `obsidian` DB is separate (for LiveSync plugin if you use Obsidian desktop).
- Use nested paths for folders: `2024/01/notes` creates 3 levels.
