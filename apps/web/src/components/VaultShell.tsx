import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionIcon,
  AppShell,
  Badge,
  Box,
  Burger,
  Button,
  Card,
  Center,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconAlertTriangle, IconArrowBackUp, IconDatabase, IconDiamond, IconFiles, IconFolderPlus, IconGraph, IconInbox, IconLock, IconPaperclip, IconPlus, IconSearch, IconSparkles } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { DndContext, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { api, ensureViewCookie, fileUrl } from "../api";
import type { FileEntry, GraphPayload, LintReport, MainView, NoteMode, OpenTab } from "../types";
import { HTML_EXT, IMAGE_EXT, SITE_SRC, buildTree, filterTree, isMarkdownPath } from "../lib/tree";
import { describeOp, pushOp, type VaultOp } from "../lib/undo";
import { wordCount } from "../lib/wikilinks";
import { spring } from "../theme";
import { RootDrop, SortableFile } from "./FileTree";
import { EditorPane } from "./EditorPane";
import { CommandPalette } from "./CommandPalette";
import { RightRail } from "./RightRail";
import { StatusBar } from "./StatusBar";
import { SurrealStudio } from "./SurrealStudio";
import { InboxView } from "./InboxView";


const GraphView = lazy(() => import("./GraphView"));

export function VaultShell({ onLogout }: { onLogout: () => void }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<MainView>("note");
  const [mode, setMode] = useState<NoteMode>("preview");
  const [newPath, setNewPath] = useState("");
  const [search, setSearch] = useState("");
  const [couchCount, setCouchCount] = useState(0);
  const [vaultPath, setVaultPath] = useState("/data/vault");
  const [opened, setOpened] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [palette, setPalette] = useState(false);
  const [rail, setRail] = useState(true);
  const [edges, setEdges] = useState<GraphPayload["edges"]>([]);
  const [lint, setLint] = useState<LintReport | null>(null);
  const [history, setHistory] = useState<VaultOp[]>([]);
  const historyRef = useRef<VaultOp[]>([]);
  const tabsRef = useRef<OpenTab[]>([]);
  const selectedRef = useRef<string | null>(null);
  const isResizing = useRef(false);
  const filePick = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const tree = useMemo(() => buildTree(files), [files]);
  const filtered = useMemo(() => filterTree(tree, search), [tree, search]);
  const active = tabs.find((t) => t.path === selected) || null;
  const counts = wordCount(active?.content || "");
  tabsRef.current = tabs;
  selectedRef.current = selected;
  historyRef.current = history;

  function record(op: VaultOp) {
    setHistory((h) => {
      const next = pushOp(h, op);
      historyRef.current = next;
      return next;
    });
  }

  async function refreshFiles() {
    try {
      const r = await api<{ files: FileEntry[]; vault?: string }>("/api/files");
      setFiles(r.files);
      if (r.vault) setVaultPath(r.vault);
    } catch {
      /* ignore */
    }
    void refreshMeta();
  }

  async function refreshMeta() {
    try {
      const c = await api<{ files: Array<{ id: string }> }>("/api/vault/files");
      setCouchCount(c.files.length);
    } catch {
      /* couch optional */
    }
    try {
      const g = await api<GraphPayload>("/api/graph");
      setEdges(g.edges);
    } catch {
      /* graph optional */
    }
    try {
      setLint(await api<LintReport>("/api/lint"));
    } catch {
      /* lint optional */
    }
  }

  useEffect(() => {
    ensureViewCookie();
    refreshFiles();
  }, []);

  async function openFile(p: string, nextMode?: NoteMode) {
    const existing = tabs.find((t) => t.path === p);
    if (existing) {
      setSelected(p);
      setView("note");
      if (nextMode) setMode(nextMode);
      setOpened(false);
      return;
    }
    if (IMAGE_EXT.test(p)) {
      setTabs((prev) => [...prev.filter((t) => t.path !== p), { path: p, content: "", saved: "", dirty: false }]);
      setSelected(p);
      setView("note");
      setMode("preview");
      setOpened(false);
      return;
    }
    try {
      const r = await api<{ content: string; path: string }>(`/api/files/content?path=${encodeURIComponent(p)}`);
      const path = r.path || p;
      setTabs((prev) => [...prev.filter((t) => t.path !== path), { path, content: r.content, saved: r.content, dirty: false }]);
      setSelected(path);
      setView("note");
      setMode(nextMode || "preview");
      setOpened(false);
    } catch {
      notifications.show({ title: "Missing note", message: p, color: "orange" });
    }
  }

  async function save(path = selected) {
    const tab = tabsRef.current.find((t) => t.path === path);
    if (!tab) return;
    try {
      await api(fileUrl(tab.path), { method: "PUT", body: JSON.stringify({ content: tab.content }) });
      if (tab.saved !== tab.content) record({ kind: "write", path: tab.path, before: tab.saved, after: tab.content });
      setTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, dirty: false, saved: tab.content } : t)));
      notifications.show({ title: "Saved", message: tab.path, color: "violet" });
      refreshFiles();
    } catch (e) {
      notifications.show({ title: "Error", message: String(e), color: "red" });
    }
  }

  async function createAt(raw: string) {
    const p = raw.trim().replace(/^\/+/, "");
    if (!p) return;
    const site = /\.(html?|css|js|mjs)$/i.test(p);
    const nested = p.includes("/") ? p : site ? `html/${p}` : `wiki/${p}`;
    const finalPath = site || nested.endsWith(".md") ? nested : `${nested}.md`;
    const title = finalPath.replace(/\.(md|html?|css|js|mjs)$/i, "").split("/").pop() || "note";
    const seed = HTML_EXT.test(finalPath)
      ? `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="utf-8" />\n  <title>${title}</title>\n  <style>\n    :root { color-scheme: dark; }\n    body { font-family: system-ui, sans-serif; margin: 2rem; background: #0c0a14; color: #f4eefc; }\n  </style>\n</head>\n<body>\n  <h1>${title}</h1>\n  <p>Linked CSS/JS in this folder load after you save.</p>\n  <script>console.log(${JSON.stringify(title)});</script>\n</body>\n</html>\n`
      : SITE_SRC.test(finalPath)
        ? `/* ${title} */\n`
        : `# ${title}\n\n`;
    try {
      await api(fileUrl(finalPath), { method: "PUT", body: JSON.stringify({ content: seed }) });
      record({ kind: "create", path: finalPath, after: seed });
      setNewPath("");
      await refreshFiles();
      await openFile(finalPath, "edit");
    } catch (err) {
      notifications.show({ title: "Create failed", message: String(err), color: "red" });
    }
  }

  async function createFile(e?: React.FormEvent) {
    e?.preventDefault();
    if (newPath.trim().endsWith("/")) {
      await createFolder(newPath);
      return;
    }
    await createAt(newPath);
  }

  async function createFolder(raw: string) {
    const p = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (!p) return;
    const nested = p.includes("/") ? p : `wiki/${p}`;
    try {
      const r = await api<{ path: string; existed?: boolean }>("/api/files/mkdir", { method: "POST", body: JSON.stringify({ path: nested }) });
      if (!r.existed) record({ kind: "mkdir", path: r.path });
      setNewPath("");
      await refreshFiles();
      notifications.show({ title: r.existed ? "Folder exists" : "Folder created", message: r.path, color: "violet" });
    } catch (err) {
      notifications.show({ title: "Folder failed", message: String(err), color: "red" });
    }
  }

  function remapOpen(from: string, to: string) {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.path === from) return { ...t, path: to };
        if (t.path.startsWith(`${from}/`)) return { ...t, path: `${to}${t.path.slice(from.length)}` };
        return t;
      }),
    );
    setSelected((cur) => {
      if (!cur) return cur;
      if (cur === from) return to;
      if (cur.startsWith(`${from}/`)) return `${to}${cur.slice(from.length)}`;
      return cur;
    });
  }

  async function uploadAttachment(file: File) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const dest = /\.(html?|css|js|mjs)$/i.test(safe) ? `html/${safe}` : `raw/assets/${safe}`;
      const r = await api<{ embed: string }>("/api/files/upload", { method: "POST", body: JSON.stringify({ name: file.name, base64, path: dest }) });
      notifications.show({ title: "Attached", message: r.embed, color: "violet" });
      await refreshFiles();
    } catch (e) {
      notifications.show({ title: "Upload failed", message: String(e), color: "red" });
    }
  }

  async function snapshot(p: string): Promise<Array<{ path: string; content: string }>> {
    const targets = files.filter((f) => f.type === "file" && (f.path === p || f.path.startsWith(`${p}/`)));
    const out: Array<{ path: string; content: string }> = [];
    for (const t of targets) {
      const open = tabsRef.current.find((tab) => tab.path === t.path);
      if (open) {
        out.push({ path: t.path, content: open.saved });
        continue;
      }
      try {
        const r = await api<{ content: string }>(`/api/files/content?path=${encodeURIComponent(t.path)}`);
        out.push({ path: t.path, content: r.content });
      } catch {
        /* skip unreadables */
      }
    }
    return out;
  }

  async function delFile(p: string) {
    if (!confirm(`Delete ${p}?`)) return;
    try {
      const snap = await snapshot(p);
      await api(fileUrl(p), { method: "DELETE" });
      if (snap.length) record({ kind: "delete", files: snap });
      setTabs((prev) => prev.filter((t) => t.path !== p && !t.path.startsWith(`${p}/`)));
      if (selected === p || selected?.startsWith(`${p}/`)) {
        const next = tabsRef.current.find((t) => t.path !== p && !t.path.startsWith(`${p}/`));
        setSelected(next?.path ?? null);
      }
      refreshFiles();
    } catch (err) {
      notifications.show({ title: "Delete failed", message: String(err), color: "red" });
    }
  }

  function destDirFromOver(overId: string): string | null {
    if (overId === "folder:" || overId === "__root__") return "";
    if (overId.startsWith("folder:")) return overId.slice("folder:".length);
    const hit = files.find((f) => f.path === overId);
    if (hit?.type === "dir") return hit.path;
    if (hit?.type === "file") return hit.path.includes("/") ? hit.path.slice(0, hit.path.lastIndexOf("/")) : "";
    return null;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const activeId = String(a.id);
    const destDir = destDirFromOver(String(over.id));
    if (destDir === null) return;
    const name = activeId.split("/").pop() || activeId;
    const dest = destDir ? `${destDir}/${name}` : name;
    if (dest === activeId || dest.startsWith(`${activeId}/`)) return;
    try {
      const r = await api<{ to: string }>("/api/files/move", { method: "POST", body: JSON.stringify({ from: activeId, to: destDir || dest }) });
      const to = r.to || dest;
      record({ kind: "move", from: activeId, to });
      remapOpen(activeId, to);
      await refreshFiles();
      notifications.show({ title: "Moved", message: `${activeId} → ${to}`, color: "violet" });
    } catch (err) {
      notifications.show({ title: "Move failed", message: String(err), color: "red" });
    }
  }

  async function undo() {
    const tab = tabsRef.current.find((t) => t.path === selectedRef.current);
    if (tab?.dirty) {
      setTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, content: t.saved, dirty: false } : t)));
      notifications.show({ title: "Reverted", message: tab.path, color: "violet" });
      return;
    }
    const op = historyRef.current[historyRef.current.length - 1];
    if (!op) {
      notifications.show({ title: "Nothing to undo", message: "No vault changes in this session", color: "gray" });
      return;
    }
    setHistory((h) => h.slice(0, -1));
    historyRef.current = historyRef.current.slice(0, -1);
    try {
      if (op.kind === "write") {
        await api(fileUrl(op.path), { method: "PUT", body: JSON.stringify({ content: op.before }) });
        setTabs((prev) => prev.map((t) => (t.path === op.path ? { ...t, content: op.before, saved: op.before, dirty: false } : t)));
      } else if (op.kind === "create") {
        await api(`${fileUrl(op.path)}?force=1`, { method: "DELETE" });
        setTabs((prev) => prev.filter((t) => t.path !== op.path));
        if (selectedRef.current === op.path) setSelected(null);
      } else if (op.kind === "delete") {
        for (const f of op.files) {
          await api(`${fileUrl(f.path)}?force=1`, { method: "PUT", body: JSON.stringify({ content: f.content }) });
        }
      } else if (op.kind === "mkdir") {
        await api(`${fileUrl(op.path)}?force=1`, { method: "DELETE" });
      } else if (op.kind === "move") {
        await api("/api/files/move", { method: "POST", body: JSON.stringify({ from: op.to, to: op.from }) });
        remapOpen(op.to, op.from);
      }
      await refreshFiles();
      notifications.show({ title: "Undone", message: describeOp(op), color: "violet" });
    } catch (e) {
      notifications.show({ title: "Undo failed", message: String(e), color: "red" });
    }
  }

  const nextUndo = active?.dirty ? `Revert unsaved ${active.path}` : describeOp(history[history.length - 1]);
  const canUndo = !!active?.dirty || history.length > 0;

  function closeTab(p: string) {
    const tab = tabs.find((t) => t.path === p);
    if (tab?.dirty && !confirm(`Close unsaved ${p}?`)) return;
    const next = tabs.filter((t) => t.path !== p);
    setTabs(next);
    if (selected === p) setSelected(next[next.length - 1]?.path ?? null);
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (selected) save(selected);
      } else if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "TEXTAREA" || tag === "INPUT") return;
        e.preventDefault();
        void undo();
      } else if (meta && (e.key.toLowerCase() === "k" || e.key.toLowerCase() === "o")) {
        e.preventDefault();
        setPalette(true);
      } else if (meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setView((v) => (v === "graph" ? "note" : "graph"));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selected, tabs, history]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      setSidebarWidth(Math.min(500, Math.max(200, e.clientX)));
    };
    const onUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const noteFiles = files.filter((f) => f.type === "file").length;

  return (
    <AppShell
      header={{ height: 56 }}
      footer={{ height: 28 }}
      navbar={{ width: sidebarWidth, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding={0}
      style={{ background: "transparent" }}
    >
      <AppShell.Header className="glass-strong header-shine" style={{ borderBottom: "1px solid rgba(214,188,255,0.12)", borderRadius: 0 }}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={() => setOpened((o) => !o)} hiddenFrom="sm" size="sm" color="violet" />
            <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={spring}>
              <ThemeIcon variant="gradient" gradient={{ from: "violet", to: "pink" }} radius="md">
                <IconDiamond size={20} />
              </ThemeIcon>
            </motion.div>
            <Title order={4} className="wordmark" style={{ fontSize: 22 }}>
              Obsidian
            </Title>
            <Badge variant="gradient" gradient={{ from: "violet", to: "pink" }} leftSection={<IconFiles size={12} />}>
              {noteFiles} notes
            </Badge>
            <Badge variant="outline" color="gray" visibleFrom="sm">
              {couchCount} Couch
            </Badge>
            {lint && (lint.orphans.length + lint.dangling.length) > 0 && (
              <Tooltip label={`${lint.orphans.length} orphans · ${lint.dangling.length} dangling`}>
                <Badge
                  variant="light"
                  color="orange"
                  leftSection={<IconAlertTriangle size={12} />}
                  style={{ cursor: "pointer" }}
                  onClick={() => openFile("index.md")}
                >
                  {lint.orphans.length + lint.dangling.length} lint
                </Badge>
              </Tooltip>
            )}
          </Group>
          <Group wrap="nowrap">
            <Tooltip label={canUndo ? `${nextUndo} · ⌘Z` : "Nothing to undo"}>
              <ActionIcon variant="subtle" color={canUndo ? "violet" : "gray"} onClick={() => void undo()} disabled={!canUndo} title="Undo">
                <IconArrowBackUp size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Quick switcher ⌘K">
              <Button
                variant="light"
                color="violet"
                size="xs"
                radius="md"
                leftSection={<IconSearch size={14} />}
                onClick={() => setPalette(true)}
                visibleFrom="sm"
              >
                Search
              </Button>
            </Tooltip>
            <ActionIcon variant="subtle" color="gray" title="Attach file" onClick={() => filePick.current?.click()}>
              <IconPaperclip size={16} />
            </ActionIcon>
            <input
              ref={filePick}
              type="file"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void uploadAttachment(f);
              }}
            />
            <Button
              variant={view === "graph" ? "gradient" : "light"}
              gradient={{ from: "violet", to: "pink" }}
              size="xs"
              radius="md"
              leftSection={<IconGraph size={14} />}
              onClick={() => setView(view === "graph" ? "note" : "graph")}
            >
              Graph
            </Button>
            <Button variant={view === "surreal" ? "light" : "subtle"} color="violet" size="xs" leftSection={<IconDatabase size={14} />} onClick={() => setView(view === "surreal" ? "note" : "surreal")}>
              Surreal
            </Button>
            <Button variant={view === "inbox" ? "light" : "subtle"} color="violet" size="xs" leftSection={<IconInbox size={14} />} onClick={() => setView(view === "inbox" ? "note" : "inbox")}>
              Inbox
            </Button>
            <ActionIcon variant="subtle" color="gray" onClick={() => setRail((r) => !r)} visibleFrom="md" title="Toggle outline">
              <IconFiles size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray" onClick={onLogout} title="Lock">
              <IconLock size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p={0} className="glass" style={{ borderRight: "1px solid rgba(124,58,237,0.12)", borderRadius: 0, overflow: "hidden" }}>
        <Box p="xs" style={{ borderBottom: "1px solid rgba(124,58,237,0.08)" }}>
          <form onSubmit={createFile}>
            <Group gap={6}>
              <TextInput
                placeholder="wiki/name or html/page.html"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                size="xs"
                radius="md"
                style={{ flex: 1 }}
                leftSection={<IconPlus size={14} />}
                styles={{ input: { background: "rgba(15,15,16,0.55)", borderColor: "rgba(124,58,237,0.2)" } }}
              />
              <ActionIcon type="submit" variant="gradient" gradient={{ from: "violet", to: "pink" }} title="New note">
                <IconPlus size={14} />
              </ActionIcon>
              <ActionIcon
                variant="light"
                color="violet"
                title="New folder"
                onClick={() => {
                  const name = window.prompt("Folder path", newPath.trim() || "wiki/folder");
                  if (name) void createFolder(name);
                }}
              >
                <IconFolderPlus size={14} />
              </ActionIcon>
            </Group>
          </form>
          <TextInput
            placeholder="Filter notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="xs"
            radius="md"
            mt="xs"
            leftSection={<IconSearch size={14} />}
            styles={{ input: { background: "rgba(15,15,16,0.55)", borderColor: "rgba(124,58,237,0.15)" } }}
          />
        </Box>
        <ScrollArea style={{ flex: 1 }} p="xs">
          {filtered.length === 0 ? (
            <Card withBorder radius="md" p="md" style={{ background: "rgba(124,58,237,0.06)", borderColor: "rgba(124,58,237,0.15)", borderStyle: "dashed" }}>
              <Text size="xs" c="dimmed" ta="center">
                No notes
                <br />
                Use <Text span c="violet" ff="monospace">[[wikilinks]]</Text> for the graph
              </Text>
            </Card>
          ) : (
            <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={handleDragEnd}>
              <RootDrop>
                <Stack gap={2}>
                  {filtered.map((node, i) => (
                    <motion.div key={node.path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.02 }}>
                      <SortableFile
                        node={node}
                        depth={0}
                        selected={selected}
                        forceOpen={!!search}
                        onOpen={openFile}
                        onDelete={delFile}
                        onNewNote={(parent) => {
                          const name = window.prompt("Note name", "untitled");
                          if (name) void createAt(`${parent}/${name}`);
                        }}
                        onNewFolder={(parent) => {
                          const name = window.prompt("Folder name", "untitled");
                          if (name) void createFolder(`${parent}/${name}`);
                        }}
                      />
                    </motion.div>
                  ))}
                </Stack>
              </RootDrop>
            </DndContext>
          )}
        </ScrollArea>
        <Box p="xs" style={{ borderTop: "1px solid rgba(124,58,237,0.08)", background: "rgba(15,15,16,0.35)" }}>
          <Text size="xs" c="dimmed">
            Vault <Text span ff="monospace" c="violet">{vaultPath}</Text>
            <br />
            wiki/ notes · raw/ sources · html/ live · drag to move
          </Text>
        </Box>
      </AppShell.Navbar>

      <div
        className={`resize-handle${isResizing.current ? " is-active" : ""}`}
        style={{ left: sidebarWidth - 2 }}
        onMouseDown={() => {
          isResizing.current = true;
          document.body.style.cursor = "col-resize";
        }}
      />

      <AppShell.Main style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 84px)", minHeight: 0 }}>
        <AnimatePresence mode="wait">
          {view === "surreal" ? (
            <motion.div key="surreal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <SurrealStudio />
            </motion.div>
          ) : view === "inbox" ? (
            <motion.div key="inbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <InboxView />
            </motion.div>
          ) : view === "graph" ? (
            <motion.div key="graph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <Suspense
                fallback={
                  <Center style={{ flex: 1 }}>
                    <Text c="dimmed">Loading graph…</Text>
                  </Center>
                }
              >
                <GraphView onOpen={(p) => openFile(p)} />
              </Suspense>
            </motion.div>
          ) : active ? (
            <motion.div key="note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <EditorPane
                tabs={tabs}
                active={active}
                mode={mode}
                files={files}
                onSelect={setSelected}
                onClose={closeTab}
                onChange={(content) => setTabs((prev) => prev.map((t) => (t.path === active.path ? { ...t, content, dirty: true } : t)))}
                onSave={() => save(active.path)}
                onOpen={openFile}
                onMode={setMode}
              />
              {rail && isMarkdownPath(active.path) && (
                <RightRail
                  content={active.content}
                  path={active.path}
                  edges={edges}
                  onJump={(id) => {
                    setMode("preview");
                    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                  onOpen={openFile}
                />
              )}
            </motion.div>
          ) : (
            <motion.div key="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring} style={{ flex: 1, display: "flex" }}>
              <Center style={{ flex: 1 }}>
                <Card className="glass-strong" withBorder radius="xl" p="xl" style={{ maxWidth: 440, textAlign: "center" }}>
                  <ThemeIcon size={56} radius="xl" variant="gradient" gradient={{ from: "violet", to: "pink" }} mb="md" mx="auto">
                    <IconSparkles size={28} />
                  </ThemeIcon>
                  <Title order={3} className="wordmark" style={{ fontSize: 32 }}>This host is the vault</Title>
                  <Text c="dimmed" size="sm" mt="xs">
                    Open <Text span ff="monospace" c="violet">wiki/</Text> or create a note.
                    <br />
                    Agents read <Text span ff="monospace" c="violet">index.md</Text> first · ⌘K to jump.
                  </Text>
                  <Button mt="md" variant="light" color="violet" onClick={() => setPalette(true)}>
                    Quick switcher
                  </Button>
                </Card>
              </Center>
            </motion.div>
          )}
        </AnimatePresence>
      </AppShell.Main>

      <AppShell.Footer className="glass" style={{ borderTop: "1px solid rgba(124,58,237,0.12)", borderRadius: 0 }}>
        <StatusBar path={active?.path ?? null} words={counts.words} chars={counts.chars} dirty={!!active?.dirty} vault={vaultPath} notes={noteFiles} />
      </AppShell.Footer>

      <CommandPalette
        open={palette}
        files={files}
        onClose={() => setPalette(false)}
        onOpen={openFile}
        onNew={() => {
          setPalette(false);
          const name = window.prompt("New note path", "wiki/untitled");
          if (name) void createAt(name);
        }}
        onNewFolder={() => {
          setPalette(false);
          const name = window.prompt("Folder path", "wiki/folder");
          if (name) void createFolder(name);
        }}
        onNewHtml={() => {
          setPalette(false);
          const name = window.prompt("HTML path", "html/untitled.html");
          if (name) void createAt(name);
        }}
        onGraph={() => setView("graph")}
        onTogglePreview={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
        onOpenIndex={() => openFile("index.md")}
        onOpenAgents={() => openFile("AGENTS.md")}
        onOpenLog={() => openFile("log.md")}
        onUndo={() => void undo()}
      />
    </AppShell>
  );
}