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
import { IconDiamond, IconFiles, IconGraph, IconLock, IconPlus, IconSearch, IconSparkles } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { api, fileUrl } from "../api";
import type { FileEntry, GraphPayload, MainView, NoteMode, OpenTab } from "../types";
import { buildTree, filterTree, flattenIds } from "../lib/tree";
import { wordCount } from "../lib/wikilinks";
import { spring } from "../theme";
import { SortableFile } from "./FileTree";
import { EditorPane } from "./EditorPane";
import { CommandPalette } from "./CommandPalette";
import { RightRail } from "./RightRail";
import { StatusBar } from "./StatusBar";

const GraphView = lazy(() => import("./GraphView"));

export function VaultShell({ onLogout }: { onLogout: () => void }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<MainView>("note");
  const [mode, setMode] = useState<NoteMode>("edit");
  const [newPath, setNewPath] = useState("");
  const [search, setSearch] = useState("");
  const [couchCount, setCouchCount] = useState(0);
  const [vaultPath, setVaultPath] = useState("/data/vault");
  const [opened, setOpened] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [palette, setPalette] = useState(false);
  const [rail, setRail] = useState(true);
  const [edges, setEdges] = useState<GraphPayload["edges"]>([]);
  const isResizing = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const tree = useMemo(() => buildTree(files), [files]);
  const filtered = useMemo(() => filterTree(tree, search), [tree, search]);
  const flatIds = useMemo(() => flattenIds(filtered), [filtered]);
  const active = tabs.find((t) => t.path === selected) || null;
  const counts = wordCount(active?.content || "");

  async function refreshFiles() {
    try {
      const r = await api<{ files: FileEntry[]; vault?: string }>("/api/files");
      setFiles(r.files);
      if (r.vault) setVaultPath(r.vault);
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
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
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
    try {
      const r = await api<{ content: string; path: string }>(`/api/files/content?path=${encodeURIComponent(p)}`);
      const path = r.path || p;
      setTabs((prev) => [...prev.filter((t) => t.path !== path), { path, content: r.content, dirty: false }]);
      setSelected(path);
      setView("note");
      setMode(nextMode || "edit");
      setOpened(false);
    } catch {
      notifications.show({ title: "Missing note", message: p, color: "orange" });
    }
  }

  async function save(path = selected) {
    const tab = tabs.find((t) => t.path === path);
    if (!tab) return;
    try {
      await api(fileUrl(tab.path), { method: "PUT", body: JSON.stringify({ content: tab.content }) });
      setTabs((prev) => prev.map((t) => (t.path === tab.path ? { ...t, dirty: false } : t)));
      notifications.show({ title: "Saved", message: tab.path, color: "violet" });
      refreshFiles();
    } catch (e) {
      notifications.show({ title: "Error", message: String(e), color: "red" });
    }
  }

  async function createAt(raw: string) {
    const p = raw.trim().replace(/^\/+/, "");
    if (!p) return;
    const finalPath = p.endsWith(".md") ? p : `${p}.md`;
    const title = finalPath.replace(/\.md$/, "").split("/").pop() || "note";
    const seed = `# ${title}\n\n`;
    try {
      await api(fileUrl(finalPath), { method: "PUT", body: JSON.stringify({ content: seed }) });
      setNewPath("");
      await refreshFiles();
      await openFile(finalPath);
    } catch (err) {
      notifications.show({ title: "Create failed", message: String(err), color: "red" });
    }
  }

  async function createFile(e?: React.FormEvent) {
    e?.preventDefault();
    await createAt(newPath);
  }

  async function delFile(p: string) {
    if (!confirm(`Delete ${p}?`)) return;
    try {
      await api(fileUrl(p), { method: "DELETE" });
      setTabs((prev) => prev.filter((t) => t.path !== p && !t.path.startsWith(`${p}/`)));
      if (selected === p || selected?.startsWith(`${p}/`)) {
        const next = tabs.find((t) => t.path !== p && !t.path.startsWith(`${p}/`));
        setSelected(next?.path ?? null);
      }
      refreshFiles();
    } catch (err) {
      notifications.show({ title: "Delete failed", message: String(err), color: "red" });
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active: a, over } = event;
    if (!over || a.id === over.id) return;
    const activeId = String(a.id);
    const overId = String(over.id);
    const activeIsFile = files.some((f) => f.path === activeId && f.type === "file");
    const overIsDir = files.some((f) => f.path === overId && f.type === "dir") || tree.some((n) => n.path === overId && n.type === "dir");
    if (!activeIsFile || !overIsDir) return;
    const fileName = activeId.split("/").pop()!;
    const dest = overId ? `${overId}/${fileName}` : fileName;
    if (dest === activeId) return;
    try {
      const r = await api<{ content: string }>(`/api/files/content?path=${encodeURIComponent(activeId)}`);
      await api(fileUrl(dest), { method: "PUT", body: JSON.stringify({ content: r.content }) });
      await api(fileUrl(activeId), { method: "DELETE" });
      setTabs((prev) => prev.map((t) => (t.path === activeId ? { ...t, path: dest } : t)));
      if (selected === activeId) setSelected(dest);
      refreshFiles();
      notifications.show({ title: "Moved", message: `${activeId} → ${dest}`, color: "violet" });
    } catch (err) {
      notifications.show({ title: "Move failed", message: String(err), color: "red" });
    }
  }

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
  }, [selected, tabs]);

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
      <AppShell.Header className="glass-strong" style={{ borderBottom: "1px solid rgba(124,58,237,0.16)", borderRadius: 0 }}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group wrap="nowrap">
            <Burger opened={opened} onClick={() => setOpened((o) => !o)} hiddenFrom="sm" size="sm" color="violet" />
            <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={spring}>
              <ThemeIcon variant="gradient" gradient={{ from: "violet", to: "pink" }} radius="md">
                <IconDiamond size={20} />
              </ThemeIcon>
            </motion.div>
            <Title order={4} style={{ letterSpacing: -0.5, background: "linear-gradient(90deg, #fff, #c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Obsidian Remote
            </Title>
            <Badge variant="gradient" gradient={{ from: "violet", to: "pink" }} leftSection={<IconFiles size={12} />}>
              {noteFiles} notes
            </Badge>
            <Badge variant="outline" color="gray" visibleFrom="sm">
              {couchCount} Couch
            </Badge>
          </Group>
          <Group wrap="nowrap">
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
            <Button
              variant={view === "graph" ? "gradient" : "light"}
              gradient={{ from: "violet", to: "pink" }}
              size="xs"
              radius="md"
              leftSection={<IconGraph size={14} />}
              onClick={() => setView(view === "graph" ? "note" : "graph")}
            >
              {view === "graph" ? "Editor" : "Graph"}
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
                placeholder="new note → path/to/note"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                size="xs"
                radius="md"
                style={{ flex: 1 }}
                leftSection={<IconPlus size={14} />}
                styles={{ input: { background: "rgba(15,15,16,0.55)", borderColor: "rgba(124,58,237,0.2)" } }}
              />
              <ActionIcon type="submit" variant="gradient" gradient={{ from: "violet", to: "pink" }}>
                <IconPlus size={14} />
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={flatIds} strategy={verticalListSortingStrategy}>
                <Stack gap={2}>
                  {filtered.map((node, i) => (
                    <motion.div key={node.path} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.02 }}>
                      <SortableFile node={node} depth={0} selected={selected} forceOpen={!!search} onOpen={openFile} onDelete={delFile} />
                    </motion.div>
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>
        <Box p="xs" style={{ borderTop: "1px solid rgba(124,58,237,0.08)", background: "rgba(15,15,16,0.35)" }}>
          <Text size="xs" c="dimmed">
            Vault <Text span ff="monospace" c="violet">{vaultPath}</Text>
            <br />
            drag a file onto a folder · drag the edge to resize
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
          {view === "graph" ? (
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
              {rail && (
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
                  <Title order={4}>This host is the vault</Title>
                  <Text c="dimmed" size="sm" mt="xs">
                    Open a note, or create <Text span ff="monospace" c="violet">path/to/note</Text>.
                    <br />
                    Link with <Text span c="violet" ff="monospace">[[wikilinks]]</Text> · jump with ⌘K.
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
          const name = window.prompt("New note path", "untitled");
          if (name) void createAt(name);
        }}
        onGraph={() => setView("graph")}
        onTogglePreview={() => setMode((m) => (m === "edit" ? "preview" : "edit"))}
      />
    </AppShell>
  );
}