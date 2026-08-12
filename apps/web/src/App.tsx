import { useEffect, useState } from "react";

function getToken() { return localStorage.getItem("token") || ""; }
async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as Record<string, string> | undefined) };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;
  const r = await fetch(path, { ...opts, headers });
  const text = await r.text();
  let j: unknown = null;
  try { j = text ? JSON.parse(text) : null; } catch { j = text; }
  if (!r.ok) throw new Error((j as { error?: string })?.error || `HTTP ${r.status}: ${text.slice(0, 300)}`);
  return j as T;
}

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => !!localStorage.getItem("token"));
  const [needsPassword, setNeedsPassword] = useState<boolean>(true);
  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((j: { hasPassword: boolean }) => {
      if (!j.hasPassword) { setNeedsPassword(false); setAuthed(true); }
      else setNeedsPassword(true);
    }).catch(() => {});
    if (getToken()) api<{ ok: boolean }>("/api/auth/me").then(() => setAuthed(true)).catch(() => { localStorage.removeItem("token"); setAuthed(false); });
  }, []);
  if (!authed) return <Auth needsPassword={needsPassword} onAuth={(t) => { localStorage.setItem("token", t); setAuthed(true); }} />;
  return <Dashboard needsPassword={needsPassword} onLogout={() => { localStorage.removeItem("token"); setAuthed(false); }} />;
}

function Auth({ needsPassword, onAuth }: { needsPassword: boolean; onAuth: (t: string) => void }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setLoading(true);
    try {
      if (!needsPassword) { onAuth(""); return; }
      const r = await api<{ token: string }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) });
      onAuth(r.token);
    } catch (e) { setErr(String(e)); } finally { setLoading(false); }
  }
  return <div style={{ maxWidth: 400, margin: "80px auto", padding: 24, border: "1px solid #2a2a2a", borderRadius: 12, background: "#1a1a1d" }}>
    <h1 style={{ margin: 0, fontSize: 22 }}>Obsidian Remote</h1>
    <p style={{ color: "#999", fontSize: 13, marginTop: 6 }}>{needsPassword ? "Enter the APP_PASSWORD you set in Coolify." : "No password set — open mode."}</p>
    <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
      {needsPassword && <input placeholder="APP_PASSWORD" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} required autoFocus />}
      {err && <div style={{ color: "#ff6b6b", fontSize: 13, whiteSpace: "pre-wrap" }}>{err}</div>}
      <button type="submit" disabled={loading} style={{ ...btnStyle(true), opacity: loading ? 0.6 : 1 }}>{loading ? "..." : needsPassword ? "Unlock" : "Enter"}</button>
    </form>
    <p style={{ color: "#666", fontSize: 11, marginTop: 16 }}>CouchDB is internal only (hardcoded). Single vault <code>obsidian</code> — all devices sync to same DB.</p>
  </div>;
}

function Dashboard({ onLogout }: { needsPassword: boolean; onLogout: () => void }) {
  const [info, setInfo] = useState<{ vault: { dbName: string }; couchUrl: string } | null>(null);
  const [creds, setCreds] = useState<{ couchUrl: string; username: string; password: string; dbName: string } | null>(null);
  const [files, setFiles] = useState<Array<{ id: string }>>([]);
  const [err, setErr] = useState("");
  async function refresh() {
    try {
      const v = await api<{ vault: { dbName: string }; couchUrl: string }>("/api/vault");
      setInfo(v);
      const c = await api<{ couchUrl: string; username: string; password: string; dbName: string }>("/api/vault/credentials");
      setCreds(c);
      const f = await api<{ files: Array<{ id: string }> }>("/api/vault/files");
      setFiles(f.files);
    } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { refresh(); }, []);
  const couchPrefix = creds?.couchUrl || info?.couchUrl || "";
  return <div style={{ maxWidth: 860, margin: "0 auto", padding: 24 }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #2a2a2a", paddingBottom: 12, marginBottom: 20 }}>
      <div><div style={{ fontWeight: 700 }}>Obsidian Remote</div><div style={{ fontSize: 12, color: "#888" }}>single vault · <span style={{ color: "#6bff95" }}>● {info?.vault.dbName || "loading"}</span></div></div>
      <button onClick={onLogout} style={btnStyle(false)}>Lock</button>
    </header>
    {err && <div style={{ color: "#ff6b6b", fontSize: 12, marginBottom: 12 }}>{err}</div>}

    <div style={{ border: "1px solid #2a2a2a", borderRadius: 12, padding: 16, background: "#151519", marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 16 }}>{info?.vault.dbName || "obsidian"}</h2>
      <div style={{ fontSize: 12, color: "#888", marginTop: 6, wordBreak: "break-all" }}>Couch URL: <code style={{ color: "#b8b8ff" }}>{couchPrefix}</code></div>
      {creds && <div style={{ marginTop: 12, background: "#0f2a14", border: "1px solid #2a6b33", borderRadius: 8, padding: 12, fontSize: 12 }}>
        <div style={{ fontWeight: 700, color: "#6bff95", marginBottom: 6 }}>LiveSync credentials (same for all devices)</div>
        <KV k="URI" v={creds.couchUrl} /><KV k="Username" v={creds.username} /><KV k="Password" v={creds.password} /><KV k="Database" v={creds.dbName} />
        <div style={{ color: "#9f9", marginTop: 8 }}>In Obsidian → Self-hosted LiveSync → paste these 4 fields. Use <code>{creds.couchUrl}</code> — it proxies to the internal CouchDB (hardcoded password, not exposed to internet).</div>
      </div>}
      <div style={{ marginTop: 12, fontSize: 12, color: "#888" }}>Docs in vault: <b style={{ color: "#ccc" }}>{files.length}</b> {files.length > 0 && <button onClick={refresh} style={{ ...btnStyle(false), padding: "2px 8px", fontSize: 11, marginLeft: 8 }}>Refresh</button>}</div>
      <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #2a2a2a", borderRadius: 8, padding: 8, background: "#0f0f10", fontSize: 12, fontFamily: "monospace", marginTop: 8 }}>
        {files.length === 0 ? <span style={{ color: "#666" }}>No docs yet — sync from Obsidian to see chunks.</span> : files.slice(0, 200).map((f) => <div key={f.id} style={{ color: "#ccc" }}>{f.id}</div>)}
      </div>
    </div>

    <details style={{ fontSize: 12, color: "#888" }}><summary>Why no per-device users?</summary><div style={{ marginTop: 8 }}>Couch is <code>expose:5984</code> (docker network only), never mapped to host. Hardcoded <code>admin / obsidian-remote-internal-do-not-expose</code> is fine — Traefik only exposes <code>app:3000</code>. <code>APP_PASSWORD</code> gates the UI/API instead.</div></details>
  </div>;
}

function KV({ k, v }: { k: string; v: string }) {
  const [copied, setCopied] = useState(false);
  return <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}><span style={{ width: 80, color: "#888" }}>{k}</span><code style={{ flex: 1, background: "#1a1a1d", padding: "4px 6px", borderRadius: 4, wordBreak: "break-all" }}>{v}</code><button onClick={() => { navigator.clipboard.writeText(v); setCopied(true); setTimeout(() => setCopied(false), 1200); }} style={{ ...btnStyle(false), padding: "2px 8px", fontSize: 11 }}>{copied ? "Copied" : "Copy"}</button></div>;
}

const inputStyle: React.CSSProperties = { background: "#0f0f10", border: "1px solid #2a2a2a", color: "#e6e6e6", padding: "8px 10px", borderRadius: 8, outline: "none", width: "100%" };
function btnStyle(primary: boolean): React.CSSProperties {
  return { background: primary ? "#6b6cff" : "transparent", color: primary ? "#fff" : "#aaa", border: primary ? "1px solid #6b6cff" : "1px solid #2a2a2a", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 };
}
