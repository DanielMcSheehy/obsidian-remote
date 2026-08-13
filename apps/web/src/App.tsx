import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MantineProvider, AppShell, Burger, Group, Title, Text, Button, Card, Badge, TextInput, ScrollArea, ActionIcon, Tabs, Box, Stack, Tooltip, Center, ThemeIcon, createTheme } from "@mantine/core";
import { Notifications, notifications } from "@mantine/notifications";
import { IconBook, IconGraph, IconPlus, IconTrash, IconLock, IconEye, IconPencil, IconSparkles, IconFiles, IconLink, IconDeviceFloppy, IconSearch, IconDiamond } from "@tabler/icons-react";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

const theme = createTheme({
  primaryColor: "violet",
  primaryShade: 6,
  colors: {
    violet: ["#f5f0ff","#ede9fe","#ddd6fe","#c4b5fd","#a78bfa","#8b5cf6","#7c3aed","#6d28d9","#5b21b6","#4c1d95"],
  },
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  headings: { fontFamily: "JetBrains Mono, monospace" },
});

function getToken() { return localStorage.getItem("token") || ""; }
async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as Record<string, string> | undefined) };
  const t = getToken(); if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(path, { ...opts, headers }); const text = await r.text(); let j: unknown = null; try { j = text ? JSON.parse(text) : null; } catch { j = text; } if (!r.ok) throw new Error((j as { error?: string })?.error || `HTTP ${r.status}`); return j as T;
}

function useHasPassword() {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/config").then((r) => r.json()).then((j: { hasPassword: boolean }) => setHas(j.hasPassword)).catch(() => setHas(false)); }, []);
  return has;
}

export default function App() {
  return <MantineProvider theme={theme} defaultColorScheme="dark">
    <Notifications position="top-right" />
    <AppInner />
  </MantineProvider>;
}

function AppInner() {
  const has = useHasPassword();
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("token"));
  useEffect(() => { if (!getToken()) return; api<{ ok: boolean }>("/api/auth/me").then(() => setAuthed(true)).catch(() => { localStorage.removeItem("token"); setAuthed(false); }); }, []);
  if (has === null) return <Center h="100vh" c="dimmed">Loading vault…</Center>;
  if (!has) return <Vault onLogout={() => { localStorage.removeItem("token"); setAuthed(false); }} />;
  if (!authed) return <Auth onAuth={(t) => { localStorage.setItem("token", t); setAuthed(true); }} />;
  return <Vault onLogout={() => { localStorage.removeItem("token"); setAuthed(false); }} />;
}

function Auth({ onAuth }: { onAuth: (t: string) => void }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setErr(""); setLoading(true); try { const r = await api<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password: pw }) }); onAuth(r.token); notifications.show({ title: "Unlocked", message: "Welcome to your vault", color: "violet" }); } catch (e) { setErr(String(e)); } finally { setLoading(false); } }
  return <Box style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse 800px 600px at 50% -100px, #7c3aed33, transparent), radial-gradient(ellipse 600px 400px at 80% 80%, #ec489933, transparent), #0f0f10" }}>
    <Card shadow="xl" radius="xl" padding="xl" withBorder style={{ width: 420, borderColor: "#2a2a3a", background: "rgba(26,26,29,0.9)", backdropFilter: "blur(12px)" }}>
      <Stack align="center" gap="xs" mb="lg">
        <ThemeIcon size={64} radius="xl" variant="gradient" gradient={{ from: "violet", to: "pink" }}><IconDiamond size={36} /></ThemeIcon>
        <Title order={2} style={{ letterSpacing: -1 }}>Obsidian Remote</Title>
        <Text c="dimmed" size="sm" ta="center">Your vault lives on <Text span c="violet" fw={600}>obsidian.swarmlaboratory.com</Text><br />Enter <Text span c="dimmed" ff="monospace">APP_PASSWORD</Text> to continue</Text>
      </Stack>
      <form onSubmit={submit}>
        <Stack gap="md">
          <TextInput type="password" placeholder="APP_PASSWORD" value={pw} onChange={(e) => setPw(e.target.value)} leftSection={<IconLock size={16} />} size="md" radius="md" autoFocus required styles={{ input: { background: "#0f0f10", borderColor: "#2a2a3a" } }} />
          {err && <Text c="red" size="sm" ta="center">{err}</Text>}
          <Button type="submit" loading={loading} size="md" radius="md" fullWidth leftSection={<IconSparkles size={18} />} variant="gradient" gradient={{ from: "violet", to: "pink" }}>Unlock vault</Button>
        </Stack>
      </form>
      <Text c="dimmed" size="xs" ta="center" mt="md" style={{ opacity: 0.6 }}>CouchDB is internal only · single vault <Text span ff="monospace">obsidian</Text></Text>
    </Card>
  </Box>;
}

type FileEntry = { path: string; type: "file" | "dir"; size?: number; mtime?: string };

function Vault({ onLogout }: { onLogout: () => void }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"edit" | "preview" | "graph">("edit");
  const [status, setStatus] = useState("");
  const [newPath, setNewPath] = useState("");
  const [search, setSearch] = useState("");
  const [couchCount, setCouchCount] = useState(0);
  const [opened, setOpened] = useState(false);
  async function refreshFiles() {
    try {
      const r = await api<{ files: FileEntry[] }>("/api/files");
      setFiles(r.files.filter((f) => f.type === "file"));
      try { const c = await api<{ files: Array<{ id: string }> }>("/api/vault/files"); setCouchCount(c.files.length); } catch {}
    } catch (e) { setStatus(String(e)); }
  }
  useEffect(() => { refreshFiles(); }, []);
  async function openFile(p: string) {
    try { const r = await api<{ content: string }>(`/api/files/content?path=${encodeURIComponent(p)}`); setSelected(p); setContent(r.content); setDirty(false); setView("edit"); setOpened(false); } catch (e) { setStatus(String(e)); }
  }
  async function save() {
    if (!selected) return;
    try { await api(`/api/files/${encodeURIComponent(selected).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ content }) }); setDirty(false); notifications.show({ title: "Saved", message: selected, color: "violet", icon: <IconDeviceFloppy size={16} /> }); refreshFiles(); } catch (e) { notifications.show({ title: "Error", message: String(e), color: "red" }); }
  }
  async function createFile(e: React.FormEvent) { e.preventDefault(); const p = newPath.trim().replace(/^\/+/, ""); if (!p) return; const finalPath = p.endsWith(".md") ? p : `${p}.md`; try { await api(`/api/files/${encodeURIComponent(finalPath).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ content: `# ${finalPath.replace(/\.md$/, "")}\n\nStart writing…\n\nLink with [[${files[0]?.path.replace(/\.md$/, "") || "welcome"}]]` }) }); setNewPath(""); refreshFiles(); openFile(finalPath); notifications.show({ title: "Created", message: finalPath, color: "violet" }); } catch (e) { setStatus(String(e)); } }
  async function delFile(p: string) { if (!confirm(`Delete ${p}?`)) return; try { await api(`/api/files/${encodeURIComponent(p).replace(/%2F/g, "/")}`, { method: "DELETE" }); if (selected === p) { setSelected(null); setContent(""); } refreshFiles(); notifications.show({ title: "Deleted", message: p, color: "red" }); } catch (e) { setStatus(String(e)); } }
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (selected && dirty) save(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [selected, dirty, content]);
  const filtered = files.filter((f) => !search || f.path.toLowerCase().includes(search.toLowerCase()));
  return <AppShell header={{ height: 56 }} navbar={{ width: 300, breakpoint: "sm", collapsed: { mobile: !opened } }} padding={0} style={{ background: "#0f0f10" }}>
    <AppShell.Header style={{ background: "linear-gradient(90deg, #1a1a1d 0%, #1e1e2a 100%)", borderBottom: "1px solid #2a2a3a", backdropFilter: "blur(12px)" }}>
      <Group h="100%" px="md" justify="space-between">
        <Group>
          <Burger opened={opened} onClick={() => setOpened((o) => !o)} hiddenFrom="sm" size="sm" />
          <ThemeIcon variant="gradient" gradient={{ from: "violet", to: "pink" }} radius="md"><IconDiamond size={20} /></ThemeIcon>
          <Title order={4} style={{ letterSpacing: -0.5 }}>Obsidian Remote</Title>
          <Badge variant="light" color="violet" leftSection={<IconFiles size={12} />}>{files.length} notes</Badge>
          <Badge variant="outline" color="gray" leftSection={<IconLink size={12} />}>{couchCount} Couch</Badge>
        </Group>
        <Group>
          <Tooltip label="Graph view shows [[wikilinks]]"><Button variant={view === "graph" ? "filled" : "light"} color="violet" size="xs" radius="md" leftSection={<IconGraph size={14} />} onClick={() => setView(view === "graph" ? "edit" : "graph")}>{view === "graph" ? "Editor" : "Graph"}</Button></Tooltip>
          <ActionIcon variant="subtle" color="gray" onClick={onLogout}><IconLock size={16} /></ActionIcon>
        </Group>
      </Group>
    </AppShell.Header>
    <AppShell.Navbar p={0} style={{ background: "#151519", borderRight: "1px solid #2a2a3a" }}>
      <Box p="xs" style={{ borderBottom: "1px solid #2a2a3a" }}>
        <form onSubmit={createFile}>
          <Group gap={6}>
            <TextInput placeholder="new note → path/to/note" value={newPath} onChange={(e) => setNewPath(e.target.value)} size="xs" radius="md" style={{ flex: 1 }} leftSection={<IconPlus size={14} />} styles={{ input: { background: "#0f0f10", borderColor: "#2a2a3a" } }} />
            <ActionIcon type="submit" variant="gradient" gradient={{ from: "violet", to: "pink" }}><IconPlus size={14} /></ActionIcon>
          </Group>
        </form>
        <TextInput placeholder="Search notes…" value={search} onChange={(e) => setSearch(e.target.value)} size="xs" radius="md" mt="xs" leftSection={<IconSearch size={14} />} styles={{ input: { background: "#0f0f10", borderColor: "#2a2a3a" } }} />
      </Box>
      <ScrollArea style={{ flex: 1 }} p="xs">
        {filtered.length === 0 ? <Card withBorder radius="md" p="md" bg="rgba(124,58,237,0.08)" style={{ borderColor: "#2a2a3a", borderStyle: "dashed" }}><Text size="xs" c="dimmed" ta="center">No notes yet<br />Create one above<br />Use <Text span c="violet" ff="monospace">[[wikilinks]]</Text> for graph</Text></Card> :
          <Stack gap={2}>
            {filtered.map((f) => <Group key={f.path} justify="space-between" wrap="nowrap" onClick={() => openFile(f.path)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: selected === f.path ? "linear-gradient(90deg, #7c3aed22, transparent)" : "transparent", border: selected === f.path ? "1px solid #7c3aed44" : "1px solid transparent" }}>
              <Group gap={8} wrap="nowrap" style={{ overflow: "hidden" }}>
                <ThemeIcon size="xs" variant="light" color={selected === f.path ? "violet" : "gray"}><IconBook size={12} /></ThemeIcon>
                <Text size="sm" truncate style={{ color: selected === f.path ? "#fff" : "#ccc" }}>{f.path}</Text>
              </Group>
              <ActionIcon size="xs" variant="subtle" color="gray" onClick={(e) => { e.stopPropagation(); delFile(f.path); }}><IconTrash size={12} /></ActionIcon>
            </Group>)}
          </Stack>}
      </ScrollArea>
      <Box p="xs" style={{ borderTop: "1px solid #2a2a3a" }}>
        <Text size="xs" c="dimmed">Vault <Text span ff="monospace" c="violet">/data/vault</Text> on Coolify</Text>
        {status && <Text size="xs" c="yellow" mt={4}>{status}</Text>}
      </Box>
    </AppShell.Navbar>
    <AppShell.Main style={{ background: "radial-gradient(ellipse 800px 600px at 10% 0%, #7c3aed0d, transparent), #0f0f10", display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      {view === "graph" ? <GraphView onOpen={(p) => openFile(p)} /> :
        selected ? <Box style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <Group justify="space-between" p="xs" style={{ background: "#1a1a1d", borderBottom: "1px solid #2a2a3a" }}>
            <Group gap={8}>
              <Badge variant="light" color={dirty ? "orange" : "gray"} leftSection={dirty ? <IconPencil size={12} /> : <IconBook size={12} />}>{selected}</Badge>
              {dirty && <Badge color="orange" variant="dot">unsaved</Badge>}
            </Group>
            <Group gap={6}>
              <Tabs value={view} onChange={(v) => setView(v as "edit" | "preview")} variant="pills" radius="md" color="violet">
                <Tabs.List><Tabs.Tab value="edit" leftSection={<IconPencil size={12} />}>Edit</Tabs.Tab><Tabs.Tab value="preview" leftSection={<IconEye size={12} />}>Preview</Tabs.Tab></Tabs.List>
              </Tabs>
              <Button onClick={save} disabled={!dirty} size="xs" radius="md" leftSection={<IconDeviceFloppy size={14} />} variant="gradient" gradient={{ from: "violet", to: "pink" }} style={{ opacity: dirty ? 1 : 0.5 }}>Save</Button>
            </Group>
          </Group>
          <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {view === "edit" ? <textarea value={content} onChange={(e) => { setContent(e.target.value); setDirty(true); }} style={{ flex: 1, background: "#0f0f10", color: "#e6e6e6", border: "none", outline: "none", padding: 20, fontFamily: "JetBrains Mono, monospace", fontSize: 13, lineHeight: 1.7, resize: "none" }} placeholder="# Hello

[[link]] to another note" /> :
              <Box style={{ flex: 1, overflow: "auto", padding: 24, background: "#0f0f10" }}>
                <Box style={{ maxWidth: 720, margin: "0 auto", background: "#1a1a1d", border: "1px solid #2a2a3a", borderRadius: 12, padding: 24 }}>
                  <ReactMarkdown>{content || "*Empty note*"}</ReactMarkdown>
                </Box>
              </Box>}
          </Box>
        </Box> :
        <Center style={{ flex: 1 }}><Card withBorder radius="xl" p="xl" style={{ maxWidth: 400, textAlign: "center", background: "rgba(26,26,29,0.6)", borderColor: "#2a2a3a", backdropFilter: "blur(8px)" }}><ThemeIcon size={48} radius="xl" variant="gradient" gradient={{ from: "violet", to: "pink" }} mb="md"><IconSparkles size={24} /></ThemeIcon><Title order={4}>Select a note</Title><Text c="dimmed" size="sm" mt="xs">Create or open a note from the sidebar.<br />Use <Text span c="violet" ff="monospace">[[note-name]]</Text> to link notes and see them in the graph.</Text><Button mt="md" variant="light" color="violet" leftSection={<IconFiles size={14} />} onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="new note"]')?.focus()}>New note</Button></Card></Center>}
    </AppShell.Main>
  </AppShell>;
}

function GraphView({ onOpen }: { onOpen: (p: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ nodes: Array<{ id: string }>; edges: Array<{ source: string; target: string }> } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<{ nodes: Array<{ id: string }>; edges: Array<{ source: string; target: string }> }>("/api/graph").then((d) => setData({ nodes: d.nodes.map((n) => ({ id: n.id })), edges: d.edges })).catch((e) => setErr(String(e))); }, []);
  useEffect(() => {
    if (!ref.current || !data) return; ref.current.innerHTML = ""; let cleanup: (() => void) | null = null;
    (async () => {
      try {
        const mod = await import("force-graph");
        if (!ref.current) return;
        const ForceGraph = (mod as unknown as { default: unknown }).default as unknown as (el: HTMLElement) => { graphData: (d: { nodes: unknown[]; links: unknown[] }) => void; backgroundColor: (c: string) => void; nodeLabel: (f: (n: { id: string }) => string) => void; onNodeClick: (f: (n: { id: string }) => void) => void; width: (n: number) => void; height: (n: number) => void; };
        const el = ForceGraph(ref.current);
        const w = ref.current.clientWidth || 800; const h = ref.current.clientHeight || 500;
        el.width(w); el.height(h);
        el.graphData({ nodes: data.nodes.map((n) => ({ ...n })), links: data.edges.map((e) => ({ source: e.source, target: e.target })) });
        el.backgroundColor("#0f0f10");
        el.nodeLabel((n: { id: string }) => n.id);
        el.onNodeClick((n: { id: string }) => onOpen(n.id));
        const onResize = () => { if (ref.current) el.width(ref.current.clientWidth); };
        window.addEventListener("resize", onResize); cleanup = () => window.removeEventListener("resize", onResize);
      } catch (e) { setErr(String(e)); }
    })();
    return () => { if (cleanup) cleanup(); if (ref.current) ref.current.innerHTML = ""; };
  }, [data]);
  if (err) return <Center style={{ flex: 1 }}><Text c="red">{err}</Text></Center>;
  if (!data) return <Center style={{ flex: 1 }}><Text c="dimmed">Loading graph…</Text></Center>;
  return <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
    <Group justify="space-between" p="xs" style={{ background: "#1a1a1d", borderBottom: "1px solid #2a2a3a" }}>
      <Group gap={8}><Badge color="violet" variant="light">{data.nodes.length} notes</Badge><Badge color="gray" variant="outline">{data.edges.length} links</Badge><Text size="xs" c="dimmed">click node to open · [[wikilinks]] → edges</Text></Group>
      <Text size="xs" c="dimmed">2D force graph</Text>
    </Group>
    <Box ref={ref} style={{ flex: 1, background: "radial-gradient(ellipse 600px 400px at 50% 0%, #7c3aed0d, transparent), #0f0f10" }} />
  </Box>;
}
