const VIEW_COOKIE = "vault_view";

export function getToken(): string {
  return localStorage.getItem("token") || "";
}

export function setViewCookie(token: string) {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie = `${VIEW_COOKIE}=; Path=/view; Max-Age=0; SameSite=Lax`;
    return;
  }
  document.cookie = `${VIEW_COOKIE}=${encodeURIComponent(token)}; Path=/view; Max-Age=2592000; SameSite=Lax`;
}

export function ensureViewCookie() {
  const token = getToken();
  if (token) setViewCookie(token);
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
  setViewCookie(token);
}

export function clearToken() {
  localStorage.removeItem("token");
  setViewCookie("");
}

export function viewFileUrl(p: string): string {
  const rel = p.replace(/^\/+/, "");
  return `/view/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> | undefined) };
  if (opts.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(path, { ...opts, headers });
  const text = await r.text();
  let j: unknown = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = text;
  }
  if (!r.ok) throw new Error((j as { error?: string })?.error || `HTTP ${r.status}`);
  return j as T;
}

export function fileUrl(p: string): string {
  return `/api/files/${encodeURIComponent(p).replace(/%2F/g, "/")}`;
}

export function rawFileUrl(p: string): string {
  const token = getToken();
  const q = new URLSearchParams({ path: p });
  if (token) q.set("token", token);
  return `/api/files/raw?${q.toString()}`;
}

export function downloadFileUrl(p: string): string {
  const token = getToken();
  const q = new URLSearchParams({ path: p });
  if (token) q.set("token", token);
  return `/api/files/download?${q.toString()}`;
}

export function collapseSelection(paths: Iterable<string>): string[] {
  const sorted = [...paths].sort();
  return sorted.filter((p) => !sorted.some((o) => o !== p && p.startsWith(`${o}/`)));
}

export async function downloadPaths(paths: string[]): Promise<void> {
  const list = collapseSelection(paths);
  if (list.length === 0) return;
  if (list.length === 1) {
    const a = document.createElement("a");
    a.href = downloadFileUrl(list[0]);
    a.download = list[0].split("/").pop() || "download";
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch("/api/files/download", { method: "POST", headers, body: JSON.stringify({ paths: list }) });
  if (!r.ok) {
    let msg = `HTTP ${r.status}`;
    try {
      const j = (await r.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vault.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
