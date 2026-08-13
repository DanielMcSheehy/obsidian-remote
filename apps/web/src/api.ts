export function getToken(): string {
  return localStorage.getItem("token") || "";
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
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
