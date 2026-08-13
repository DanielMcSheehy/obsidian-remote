import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MantineProvider, AppShell, Burger, Group, Title, Text, Button, Card, Badge, TextInput, ScrollArea, ActionIcon, Tabs, Box, Stack, Tooltip, Center, ThemeIcon, createTheme } from "@mantine/core";
import { Notifications, notifications } from "@mantine/notifications";
import { IconBook, IconGraph, IconPlus, IconTrash, IconLock, IconEye, IconPencil, IconSparkles, IconFiles, IconLink, IconDeviceFloppy, IconSearch, IconDiamond } from "@tabler/icons-react";
import { motion, AnimatePresence } from "framer-motion";
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
  if (has === null) return <Center h="100vh" c="dimmed"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Loading vault…</motion.div></Center>;
  if (!has) return <Vault onLogout={() => { localStorage.removeItem("token"); setAuthed(false); }} />;
  if (!authed) return <Auth onAuth={(t) => { localStorage.setItem("token", t); setAuthed(true); }} />;
  return <Vault onLogout={() => { localStorage.removeItem("token"); setAuthed(false); }} />;
}

function Auth({ onAuth }: { onAuth: (t: string) => void }) {
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setErr(""); setLoading(true); try { const r = await api<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password: pw }) }); onAuth(r.token); notifications.show({ title: "Unlocked", message: "Welcome to your vault", color: "violet" }); } catch (e) { setErr(String(e)); } finally { setLoading(false); } }
  return <Box style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", position: "relative", overflow: "hidden" }}>
    {/* animated glass orbs */}
    <motion.div initial={{ scale: 0.8, opacity: 0.5 }} animate={{ scale: 1, opacity: 0.7 }} transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }} style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, #7c3aed55, transparent 70%)", top: -150, left: -100, filter: "blur(40px)" }} />
    <motion.div initial={{ scale: 0.9, opacity: 0.4 }} animate={{ scale: 1.1, opacity: 0.6 }} transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 0.5 }} style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, #ec489955, transparent 70%)", bottom: -200, right: -150, filter: "blur(40px)" }} />
    <motion.div initial={{ scale: 0.9, opacity: 0.3 }} animate={{ scale: 1, opacity: 0.5 }} transition={{ duration: 2.5, repeat: Infinity, repeatType: "reverse", delay: 1 }} style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, #06b6d455, transparent 70%)", top: "40%", left: "60%", filter: "blur(40px)" }} />
    <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ position: "relative", zIndex: 1 }}>
      <Card shadow="xl" radius="xl" padding="xl" withBorder style={{ width: 440, borderColor: "rgba(124,58,237,0.3)", background: "rgba(26,26,29,0.75)", backdropFilter: "blur(20px) saturate(180%)", boxShadow: "0 8px 32px rgba(124,58,237,0.2), inset 0 1px 0 rgba(255,255,255,0.1)" }}>
        <Stack align="center" gap="xs" mb="lg">
          <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}>
            <ThemeIcon size={72} radius="xl" variant="gradient" gradient={{ from: "violet", to: "pink" }} style={{ boxShadow: "0 0 30px rgba(124,58,237,0.5)" }}><IconDiamond size={40} /></ThemeIcon>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Title order={2} style={{ letterSpacing: -1, background: "linear-gradient(90deg, #fff, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Obsidian Remote</Title>
          </motion.div>
          <Text c="dimmed" size="sm" ta="center">Your vault lives on <Text span c="violet" fw={600}>obsidian.swarmlaboratory.com</Text><br />Enter <Text span c="dimmed" ff="monospace">APP_PASSWORD</Text> to continue</Text>
        </Stack>
        <form onSubmit={submit}>
          <Stack gap="md">
            <TextInput type="password" placeholder="APP_PASSWORD" value={pw} onChange={(e) => setPw(e.target.value)} leftSection={<IconLock size={16} />} size="md" radius="md" autoFocus required styles={{ input: { background: "rgba(15,15,16,0.8)", borderColor: "rgba(124,58,237,0.3)", backdropFilter: "blur(10px)" } }} />
            <AnimatePresence>{err && <motion.div initial={{ opacity: 0, y: -10, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -10, height: 0 }}><Text c="red" size="sm" ta="center" style={{ background: "rgba(239,68,68,0.1)", padding: 8, borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>{err}</Text></motion.div>}</AnimatePresence>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button type="submit" loading={loading} size="md" radius="md" fullWidth leftSection={<IconSparkles size={18} />} variant="gradient" gradient={{ from: "violet", to: "pink" }} style={{ boxShadow: "0 4px 20px rgba(124,58,237,0.4)" }}>Unlock vault</Button>
            </motion.div>
          </Stack>
        </form>
        <Text c="dimmed" size="xs" ta="center" mt="md" style={{ opacity: 0.5 }}>CouchDB is internal only · single vault <Text span ff="monospace">obsidian</Text></Text>
      </Card>
    </motion.div>
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
    try { await api(`/api/files/${encodeURIComponent(selected).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ content }) }); setDirty(false); notifications.show({ title: "Saved ✨", message: selected, color: "violet", icon: <IconDeviceFloppy size={16} /> }); refreshFiles(); } catch (e) { notifications.show({ title: "Error", message: String(e), color: "red" }); }
  }
  async function createFile(e: React.FormEvent) { e.preventDefault(); const p = newPath.trim().replace(/^\/+/, ""); if (!p) return; const finalPath = p.endsWith(".md") ? p : `${p}.md`; try { await api(`/api/files/${encodeURIComponent(finalPath).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ content: `# ${finalPath.replace(/\.md$/, "")}\n\nStart writing…\n\nLink with [[${files[0]?.path.replace(/\.md$/, "") || "welcome"}]]` }) }); setNewPath(""); refreshFiles(); openFile(finalPath); notifications.show({ title: "Created ✨", message: finalPath, color: "violet" }); } catch (e) { setStatus(String(e)); } }
  async function delFile(p: string) { if (!confirm(`Delete ${p}?`)) return; try { await api(`/api/files/${encodeURIComponent(p).replace(/%2F/g, "/")}`, { method: "DELETE" }); if (selected === p) { setSelected(null); setContent(""); } refreshFiles(); notifications.show({ title: "Deleted", message: p, color: "red" }); } catch (e) { setStatus(String(e)); } }
  useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (selected && dirty) save(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [selected, dirty, content]);
  const filtered = files.filter((f) => !search || f.path.toLowerCase().includes(search.toLowerCase()));
  return <AppShell header={{ height: 56 }} navbar={{ width: 300, breakpoint: "sm", collapsed: { mobile: !opened } }} padding={0} style={{ background: "#0a0a0f" }}>
    <AppShell.Header style={{ background: "rgba(21,21,25,0.8)", borderBottom: "1px solid rgba(124,58,237,0.15)", backdropFilter: "blur(20px) saturate(180%)", boxShadow: "0 4px 30px rgba(0,0,0,0.3)" }}>
      <Group h="100%" px="md" justify="space-between">
        <Group>
          <Burger opened={opened} onClick={() => setOpened((o) => !o)} hiddenFrom="sm" size="sm" color="violet" />
          <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
            <ThemeIcon variant="gradient" gradient={{ from: "violet", to: "pink" }} radius="md" style={{ boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}><IconDiamond size={20} /></ThemeIcon>
          </motion.div>
          <Title order={4} style={{ letterSpacing: -0.5, background: "linear-gradient(90deg, #fff, #c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Obsidian Remote</Title>
          <Badge variant="gradient" gradient={{ from: "violet", to: "pink" }} leftSection={<IconFiles size={12} />} style={{ boxShadow: "0 2px 10px rgba(124,58,237,0.3)" }}>{files.length} notes</Badge>
          <Badge variant="outline" color="gray" leftSection={<IconLink size={12} />} style={{ backdropFilter: "blur(10px)" }}>{couchCount} Couch</Badge>
        </Group>
        <Group>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant={view === "graph" ? "gradient" : "light"} gradient={{ from: "violet", to: "pink" }} color="violet" size="xs" radius="md" leftSection={<IconGraph size={14} />} onClick={() => setView(view === "graph" ? "edit" : "graph")} style={view === "graph" ? { boxShadow: "0 0 20px rgba(124,58,237,0.5)" } : {}}>{view === "graph" ? "Editor" : "Graph"}</Button>
          </motion.div>
          <ActionIcon variant="subtle" color="gray" onClick={onLogout} radius="md" style={{ backdropFilter: "blur(10px)" }}><IconLock size={16} /></ActionIcon>
        </Group>
      </Group>
    </AppShell.Header>
    <AppShell.Navbar p={0} style={{ background: "rgba(21,21,25,0.6)", borderRight: "1px solid rgba(124,58,237,0.1)", backdropFilter: "blur(20px)" }}>
      <Box p="xs" style={{ borderBottom: "1px solid rgba(124,58,237,0.08)" }}>
        <form onSubmit={createFile}>
          <Group gap={6}>
            <TextInput placeholder="new note → path/to/note" value={newPath} onChange={(e) => setNewPath(e.target.value)} size="xs" radius="md" style={{ flex: 1 }} leftSection={<IconPlus size={14} />} styles={{ input: { background: "rgba(15,15,16,0.6)", borderColor: "rgba(124,58,237,0.2)", backdropFilter: "blur(10px)" } }} />
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}><ActionIcon type="submit" variant="gradient" gradient={{ from: "violet", to: "pink" }} radius="md" style={{ boxShadow: "0 2px 10px rgba(124,58,237,0.3)" }}><IconPlus size={14} /></ActionIcon></motion.div>
          </Group>
        </form>
        <TextInput placeholder="Search notes…" value={search} onChange={(e) => setSearch(e.target.value)} size="xs" radius="md" mt="xs" leftSection={<IconSearch size={14} />} styles={{ input: { background: "rgba(15,15,16,0.6)", borderColor: "rgba(124,58,237,0.15)", backdropFilter: "blur(10px)" } }} />
      </Box>
      <ScrollArea style={{ flex: 1 }} p="xs">
        {filtered.length === 0 ? <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}><Card withBorder radius="md" p="md" style={{ background: "rgba(124,58,237,0.06)", borderColor: "rgba(124,58,237,0.15)", borderStyle: "dashed", backdropFilter: "blur(10px)" }}><Text size="xs" c="dimmed" ta="center">No notes yet<br />Create one above<br />Use <Text span c="violet" ff="monospace">[[wikilinks]]</Text> for graph</Text></Card></motion.div> :
          <Stack gap={2}>
            {filtered.map((f, i) => <motion.div key={f.path} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} whileHover={{ scale: 1.01, x: 2 }} whileTap={{ scale: 0.99 }}>
              <Group justify="space-between" wrap="nowrap" onClick={() => openFile(f.path)} style={{ padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: selected === f.path ? "linear-gradient(90deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))" : "transparent", border: selected === f.path ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent", backdropFilter: selected === f.path ? "blur(10px)" : "none", boxShadow: selected === f.path ? "0 2px 10px rgba(124,58,237,0.15)" : "none" }}>
                <Group gap={8} wrap="nowrap" style={{ overflow: "hidden" }}>
                  <ThemeIcon size="xs" variant={selected === f.path ? "gradient" : "light"} gradient={{ from: "violet", to: "pink" }} color={selected === f.path ? "violet" : "gray"} style={selected === f.path ? { boxShadow: "0 0 10px rgba(124,58,237,0.4)" } : {}}><IconBook size={12} /></ThemeIcon>
                  <Text size="sm" truncate style={{ color: selected === f.path ? "#fff" : "#ccc" }}>{f.path}</Text>
                </Group>
                <ActionIcon size="xs" variant="subtle" color="gray" onClick={(e) => { e.stopPropagation(); delFile(f.path); }}><IconTrash size={12} /></ActionIcon>
              </Group>
            </motion.div>)}
          </Stack>}
      </ScrollArea>
      <Box p="xs" style={{ borderTop: "1px solid rgba(124,58,237,0.08)", background: "rgba(15,15,16,0.4)", backdropFilter: "blur(10px)" }}>
        <Text size="xs" c="dimmed">Vault <Text span ff="monospace" c="violet">/data/vault</Text> on Coolify</Text>
        {status && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Text size="xs" c="yellow" mt={4}>{status}</Text></motion.div>}
      </Box>
    </AppShell.Navbar>
    <AppShell.Main style={{ background: "radial-gradient(ellipse 800px 600px at 10% 0%, rgba(124,58,237,0.08), transparent 60%), radial-gradient(ellipse 600px 400px at 90% 90%, rgba(236,72,153,0.06), transparent 60%), #0a0a0f", display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", position: "relative" }}>
      <Box style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 400px 300px at 50% 0%, rgba(124,58,237,0.04), transparent)", pointerEvents: "none" }} />
      {view === "graph" ? <GraphView onOpen={(p) => openFile(p)} /> :
        selected ? <Box style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", zIndex: 1 }}>
          <Group justify="space-between" p="xs" style={{ background: "rgba(26,26,29,0.6)", borderBottom: "1px solid rgba(124,58,237,0.1)", backdropFilter: "blur(20px)" }}>
            <Group gap={8}>
              <Badge variant="gradient" gradient={{ from: "violet", to: "pink" }} leftSection={dirty ? <IconPencil size={12} /> : <IconBook size={12} />} style={{ boxShadow: "0 2px 10px rgba(124,58,237,0.3)" }}>{selected}</Badge>
              <AnimatePresence>{dirty && <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}><Badge color="orange" variant="dot">unsaved</Badge></motion.div>}</AnimatePresence>
            </Group>
            <Group gap={6}>
              <Tabs value={view} onChange={(v) => setView(v as "edit" | "preview")} variant="pills" radius="md" color="violet">
                <Tabs.List style={{ background: "rgba(15,15,16,0.6)", borderRadius: 8, padding: 2 }}><Tabs.Tab value="edit" leftSection={<IconPencil size={12} />}>Edit</Tabs.Tab><Tabs.Tab value="preview" leftSection={<IconEye size={12} />}>Preview</Tabs.Tab></Tabs.List>
              </Tabs>
              <motion.div whileHover={{ scale: dirty ? 1.05 : 1 }} whileTap={{ scale: dirty ? 0.95 : 1 }}><Button onClick={save} disabled={!dirty} size="xs" radius="md" leftSection={<IconDeviceFloppy size={14} />} variant="gradient" gradient={{ from: "violet", to: "pink" }} style={{ opacity: dirty ? 1 : 0.4, boxShadow: dirty ? "0 4px 15px rgba(124,58,237,0.4)" : "none" }}>Save</Button></motion.div>
            </Group>
          </Group>
          <Box style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {view === "edit" ? <motion.textarea initial={{ opacity: 0 }} animate={{ opacity: 1 }} value={content} onChange={(e) => { setContent(e.target.value); setDirty(true); }} style={{ flex: 1, background: "rgba(15,15,16,0.4)", color: "#e6e6e6", border: "none", outline: "none", padding: 24, fontFamily: "JetBrains Mono, monospace", fontSize: 13, lineHeight: 1.8, resize: "none", backdropFilter: "blur(10px)" }} placeholder="# Hello

[[link]] to another note" /> :
              <Box style={{ flex: 1, overflow: "auto", padding: 24, background: "transparent" }}>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 720, margin: "0 auto", background: "rgba(26,26,29,0.6)", border: "1px solid rgba(124,58,237,0.15)", borderRadius: 16, padding: 28, backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)" }}>
                  <ReactMarkdown>{content || "*Empty note*"}</ReactMarkdown>
                </motion.div>
              </Box>}
          </Box>
        </Box> :
        <Center style={{ flex: 1, position: "relative", zIndex: 1 }}><motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}><Card withBorder radius="xl" p="xl" style={{ maxWidth: 420, textAlign: "center", background: "rgba(26,26,29,0.6)", borderColor: "rgba(124,58,237,0.2)", backdropFilter: "blur(20px) saturate(180%)", boxShadow: "0 8px 32px rgba(0,0,0,0.3), 0 0 40px rgba(124,58,237,0.1), inset 0 1px 0 rgba(255,255,255,0.05)" }}><motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}><ThemeIcon size={56} radius="xl" variant="gradient" gradient={{ from: "violet", to: "pink" }} mb="md" style={{ boxShadow: "0 0 30px rgba(124,58,237,0.4)" }}><IconSparkles size={28} /></ThemeIcon></motion.div><Title order={4} style={{ background: "linear-gradient(90deg, #fff, #a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Select a note</Title><Text c="dimmed" size="sm" mt="xs">Create or open a note from the sidebar.<br />Use <Text span c="violet" ff="monospace">[[note-name]]</Text> to link notes and see them in the graph.</Text><motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}><Button mt="md" variant="gradient" gradient={{ from: "violet", to: "pink" }} leftSection={<IconFiles size={14} />} onClick={() => document.querySelector<HTMLInputElement>('input[placeholder*="new note"]')?.focus()} style={{ boxShadow: "0 4px 15px rgba(124,58,237,0.3)" }}>New note</Button></motion.div></Card></motion.div></Center>}
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
        el.backgroundColor("#0a0a0f");
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
    <Group justify="space-between" p="xs" style={{ background: "rgba(26,26,29,0.6)", borderBottom: "1px solid rgba(124,58,237,0.1)", backdropFilter: "blur(20px)" }}>
      <Group gap={8}><Badge variant="gradient" gradient={{ from: "violet", to: "pink" }}>{data.nodes.length} notes</Badge><Badge variant="outline" color="gray" style={{ backdropFilter: "blur(10px)" }}>{data.edges.length} links</Badge><Text size="xs" c="dimmed">click node to open · [[wikilinks]] → edges</Text></Group>
      <Text size="xs" c="dimmed" style={{ background: "rgba(124,58,237,0.1)", padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(124,58,237,0.15)" }}>2D force graph</Text>
    </Group>
    <Box ref={ref} style={{ flex: 1, background: "radial-gradient(ellipse 600px 400px at 50% 0%, rgba(124,58,237,0.08), transparent 60%), #0a0a0f" }} />
  </Box>;
}
