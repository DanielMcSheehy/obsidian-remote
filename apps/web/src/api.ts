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
