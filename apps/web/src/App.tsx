import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

function getToken() { return localStorage.getItem("token") || ""; }
async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as Record<string, string> | undefined) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(path, { ...opts, headers });
  const text = await r.text();
  let j: unknown = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = text; }
  if (!r.ok) throw new Error((j as { error?: string })?.error || `HTTP ${r.status}: ${text.slice(0, 500)}`);
  return j as T;
}

// --- Auth ---
function useHasPassword() {
  const [has, setHas] = useState<boolean | null>(null);
  useEffect(() => { fetch("/api/config").then((r) => r.json()).then((j: { hasPassword: boolean }) => setHas(j.hasPassword)).catch(() => setHas(false)); }, []);
  return has;
}

export default function App() {
  const has = useHasPassword();
  const [authed, setAuthed] = useState(() => !!localStorage.getItem("token"));
  useEffect(() => {
    if (!getToken()) return;
    api<{ ok: boolean }>("/api/auth/me").then(() => setAuthed(true)).catch(() => { localStorage.removeItem("token"); setAuthed(false); });
  }, []);
  if (has === null) return <div style={{ padding: 40, color: "#888" }}>Loading…</div>;
  if (!has) return <Vault authed onLogout={() => { localStorage.removeItem("token"); setAuthed(false); }} />;
  if (!authed) return <Auth onAuth={(t) => { localStorage.setItem("token", t); setAuthed(true); }} />;
  return <Vault authed onLogout={() => { localStorage.removeItem("token"); setAuthed(false); }} />;
}

function Auth({ onAuth }: { onAuth: (t: string) => void }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setErr(""); setLoading(true); try { const r = await api<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password: pw }) }); onAuth(r.token); } catch (e) { setErr(String(e)); } finally { setLoading(false); } }
  return <div style={{ maxWidth: 420, margin: "80px auto", padding: 24, border: "1px solid #2a2a2a", borderRadius: 12, background: "#1a1a1d" }}>
    <h1 style={{ margin: 0, fontSize: 22 }}>Obsidian Remote</h1>
    <p style={{ color: "#999", fontSize: 13, marginTop: 6 }}>Vault lives on <code>obsidian.swarmlaboratory.com</code> — enter <code>APP_PASSWORD</code>.</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
      <input placeholder="APP_PASSWORD" type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={inputStyle} autoFocus required />
      {err && <div style={{ color: "#ff6b6b", fontSize: 12, whiteSpace: "pre-wrap" }}>{err}</div>}
      <button type="submit" disabled={loading} style={{ ...btnStyle(true), opacity: loading ? 0.6 : 1 }}>{loading ? "…" : "Unlock vault"}</button>
    </form>
  </div>;
}

// --- Vault ---
type FileEntry = { path: string; type: "file" | "dir"; size?: number; mtime?: string };

function Vault({ onLogout }: { authed?: boolean; onLogout: () => void }) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [view, setView] = useState<"edit" | "preview" | "graph">("edit");
  const [status, setStatus] = useState("");
  const [newPath, setNewPath] = useState("");
  const [couchFiles, setCouchFiles] = useState<Array<{ id: string }>>([]);
  async function refreshFiles() {
    try {
      const r = await api<{ files: FileEntry[] }>("/api/files");
      setFiles(r.files.filter((f) => f.type === "file"));
      // also fetch couch docs for comparison
      try { const c = await api<{ files: Array<{ id: string }> }>("/api/vault/files"); setCouchFiles(c.files); } catch {}
    } catch (e) { setStatus(String(e)); }
  }
  useEffect(() => { refreshFiles(); }, []);
  async function openFile(p: string) {
    try {
      const r = await api<{ content: string }>(`/api/files/content?path=${encodeURIComponent(p)}`);
      setSelected(p); setContent(r.content); setDirty(false); setView("edit");
    } catch (e) { setStatus(String(e)); }
  }
  async function save() {
    if (!selected) return;
    try {
      await api(`/api/files/${encodeURIComponent(selected).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ content }) });
      setDirty(false); setStatus(`Saved ${selected}`); refreshFiles();
      setTimeout(() => setStatus(""), 1500);
    } catch (e) { setStatus(String(e)); }
  }
  async function createFile(e: React.FormEvent) {
    e.preventDefault();
    const p = newPath.trim().replace(/^\/+/, "");
    if (!p) return;
    const finalPath = p.endsWith(".md") ? p : `${p}.md`;
    try {
      await api(`/api/files/${encodeURIComponent(finalPath).replace(/%2F/g, "/")}`, { method: "PUT", body: JSON.stringify({ content: `# ${finalPath}\n\n` }) });
      setNewPath(""); refreshFiles(); openFile(finalPath);
    } catch (e) { setStatus(String(e)); }
  }
  async function delFile(p: string) {
    if (!confirm(`Delete ${p}?`)) return;
    try { await api(`/api/files/${encodeURIComponent(p).replace(/%2F/g, "/")}`, { method: "DELETE" }); if (selected === p) { setSelected(null); setContent(""); } refreshFiles(); } catch (e) { setStatus(String(e)); }
  }
  // auto-save on cmd+s
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (selected && dirty) save(); } };
    window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler);
  }, [selected, dirty, content]);
  return <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0f0f10", color: "#e6e6e6" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #2a2a2a", background: "#1a1a1d" }}>
      <div><div style={{ fontWeight: 700, fontSize: 15 }}>Obsidian Remote — vault on Coolify</div><div style={{ fontSize: 11, color: "#888" }}>{files.length} files · {couchFiles.length} Couch docs · <span style={{ color: "#6bff95" }}>● vault:/data/vault</span></div></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => setView(view === "graph" ? "edit" : "graph")} style={btnStyle(view === "graph")}>{view === "graph" ? "← Editor" : "Graph view"}</button>
        <button onClick={onLogout} style={btnStyle(false)}>Lock</button>
      </div>
    </header>
    {status && <div style={{ padding: "6px 16px", background: "#1e2a1e", color: "#9f9", fontSize: 12, borderBottom: "1px solid #2a2a2a" }}>{status}</div>}
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* File tree */}
      <div style={{ width: 280, borderRight: "1px solid #2a2a2a", background: "#151519", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <form onSubmit={createFile} style={{ padding: 10, display: "flex", gap: 6, borderBottom: "1px solid #2a2a2a" }}>
          <input placeholder="new note → path/to/note" value={newPath} onChange={(e) => setNewPath(e.target.value)} style={{ ...inputStyle, flex: 1, fontSize: 12, padding: "6px 8px" }} />
          <button type="submit" style={{ ...btnStyle(true), padding: "6px 10px", fontSize: 12 }}>+</button>
        </form>
        <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
          {files.length === 0 ? <div style={{ color: "#777", fontSize: 12, padding: 12, border: "1px dashed #333", borderRadius: 8 }}>No notes yet — create one above. Supports <code>[[wikilinks]]</code> for graph.</div> :
            files.map((f) => <div key={f.path} onClick={() => openFile(f.path)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 6, cursor: "pointer", background: selected === f.path ? "#2a2a3a" : "transparent", border: selected === f.path ? "1px solid #6b6cff" : "1px solid transparent", marginBottom: 2 }}>
              <span style={{ fontSize: 13, color: selected === f.path ? "#fff" : "#ccc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.path}</span>
              <button onClick={(e) => { e.stopPropagation(); delFile(f.path); }} style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: 12 }}>×</button>
            </div>)}
        </div>
        <div style={{ padding: 10, borderTop: "1px solid #2a2a2a", fontSize: 10, color: "#666" }}>
          Vault: <code>/data/vault</code> on Coolify<br />Couch: <code>obsidian DB</code> for LiveSync (separate)
        </div>
      </div>
      {/* Main */}
      {view === "graph" ? <GraphView onOpen={(p) => openFile(p)} /> :
        selected ? <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #2a2a2a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #2a2a2a", background: "#1a1a1d" }}>
              <span style={{ fontSize: 12, color: "#888", fontFamily: "monospace" }}>{selected} {dirty && <span style={{ color: "#ffb86c" }}>• unsaved</span>}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => setView("edit")} style={btnStyle(view === "edit")}>Edit</button>
                <button onClick={() => setView("preview")} style={btnStyle(view === "preview")}>Preview</button>
                <button onClick={save} disabled={!dirty} style={{ ...btnStyle(true), opacity: dirty ? 1 : 0.4 }}>Save (Ctrl+S)</button>
              </div>
            </div>
            {view === "edit" ? <textarea value={content} onChange={(e) => { setContent(e.target.value); setDirty(true); }} style={{ flex: 1, background: "#0f0f10", color: "#e6e6e6", border: "none", outline: "none", padding: 16, fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.6, resize: "none" }} placeholder="# Hello\n\n[[link]] to another note" /> :
              <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#0f0f10" }}><ReactMarkdown>{content || "*Empty note*"}</ReactMarkdown></div>}
          </div>
          {view === "preview" && <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#1a1a1d", borderLeft: "1px solid #2a2a2a" }}>
            <div style={{ color: "#888", fontSize: 11, marginBottom: 8 }}>Preview</div><ReactMarkdown>{content}</ReactMarkdown>
          </div>}
        </div> : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#666", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14 }}>Select a note or create one</div><div style={{ fontSize: 12, color: "#888" }}>Use <code>[[note-name]]</code> to link notes — see graph view</div>
        </div>}
    </div>
  </div>;
}

function GraphView({ onOpen }: { is3d?: boolean; onToggle3d?: () => void; onOpen: (p: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ nodes: Array<{ id: string; label: string }>; edges: Array<{ source: string; target: string }> } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api<{ nodes: Array<{ id: string }>; edges: Array<{ source: string; target: string }> }>("/api/graph").then((d) => setData({ nodes: d.nodes.map((n) => ({ id: n.id, label: n.id })), edges: d.edges })).catch((e) => setErr(String(e))); }, []);
  useEffect(() => {
    if (!ref.current || !data) return;
    ref.current.innerHTML = "";
    let cleanup: (() => void) | null = null;
    (async () => {
      try {
        // dynamic: force-graph is heavy, lazy on graph view only
        const mod = await import("force-graph");
        if (!ref.current) return;
        const ForceGraph = (mod as unknown as { default: unknown }).default as unknown as (el: HTMLElement) => { graphData: (d: { nodes: unknown[]; links: unknown[] }) => void; backgroundColor: (c: string) => void; nodeLabel: (f: (n: { id: string }) => string) => void; onNodeClick: (f: (n: { id: string }) => void) => void; width: (n: number) => void; height: (n: number) => void };
        const el = ForceGraph(ref.current);
        const width = ref.current.clientWidth || 800;
        const height = ref.current.clientHeight || 500;
        el.width(width); el.height(height);
        el.graphData({ nodes: data.nodes.map((n) => ({ ...n })), links: data.edges.map((e) => ({ source: e.source, target: e.target })) });
        el.backgroundColor("#0f0f10");
        el.nodeLabel((n: { id: string }) => n.id);
        el.onNodeClick((n: { id: string }) => onOpen(n.id));
        const onResize = () => { if (ref.current) el.width(ref.current.clientWidth); };
        window.addEventListener("resize", onResize);
        cleanup = () => window.removeEventListener("resize", onResize);
      } catch (e) { setErr(String(e)); }
    })();
    return () => { if (cleanup) cleanup(); if (ref.current) ref.current.innerHTML = ""; };
  }, [data]);
  if (err) return <div style={{ flex: 1, padding: 20, color: "#ff6b6b" }}>{err}</div>;
  if (!data) return <div style={{ flex: 1, padding: 20, color: "#888" }}>Loading graph…</div>;
  return <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #2a2a2a", background: "#1a1a1d" }}>
      <span style={{ fontSize: 12, color: "#888" }}>{data.nodes.length} nodes · {data.edges.length} links · click node to open · [[wikilinks]] → edges</span>
      <span style={{ fontSize: 11, color: "#666" }}>2D force graph</span>
    </div>
    <div ref={ref} style={{ flex: 1, background: "#0f0f10", overflow: "hidden" }} />
  </div>;
}

const inputStyle: React.CSSProperties = { background: "#0f0f10", border: "1px solid #2a2a2a", color: "#e6e6e6", padding: "8px 10px", borderRadius: 8, outline: "none" };
function btnStyle(active: boolean): React.CSSProperties {
  return { background: active ? "#6b6cff" : "transparent", color: active ? "#fff" : "#aaa", border: active ? "1px solid #6b6cff" : "1px solid #2a2a2a", padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12 };
}
