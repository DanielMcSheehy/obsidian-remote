import type { FileEntry, TreeNode } from "../types";

export function buildTree(files: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const map = new Map<string, TreeNode>();
  const allPaths = new Set<string>();
  for (const f of files) {
    const parts = f.path.split("/");
    let cur = "";
    for (let i = 0; i < parts.length; i++) {
      cur = cur ? `${cur}/${parts[i]}` : parts[i];
      allPaths.add(cur);
    }
    if (f.type === "dir") allPaths.add(f.path);
  }
  for (const p of Array.from(allPaths).sort()) {
    const isFile = files.some((f) => f.path === p && f.type === "file");
    const name = p.split("/").pop() || p;
    const node: TreeNode = { name, path: p, type: isFile ? "file" : "dir", children: [], entry: files.find((f) => f.path === p) };
    map.set(p, node);
    const parentPath = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
    if (!parentPath) root.push(node);
    else {
      const parent = map.get(parentPath);
      if (parent) parent.children.push(node);
      else root.push(node);
    }
  }
  const sort = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
    nodes.forEach((n) => sort(n.children));
  };
  sort(root);
  return root;
}

export function flattenIds(nodes: TreeNode[]): string[] {
  const out: string[] = [];
  const walk = (ns: TreeNode[]) => {
    for (const n of ns) {
      out.push(n.path);
      if (n.children.length) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q) return nodes;
  const needle = q.toLowerCase();
  const match = (node: TreeNode): TreeNode | null => {
    const isMatch = node.type === "file" && node.path.toLowerCase().includes(needle);
    const children = node.children.map(match).filter(Boolean) as TreeNode[];
    if (isMatch || children.length > 0) return { ...node, children };
    return null;
  };
  return nodes.map(match).filter(Boolean) as TreeNode[];
}

export function resolveNote(files: FileEntry[], href: string): string {
  const clean = href.split("#")[0].trim();
  if (!clean) return href;
  const target = clean.endsWith(".md") ? clean : `${clean}.md`;
  const exact = files.find((f) => f.type === "file" && f.path === target);
  if (exact) return exact.path;
  const ci = files.find((f) => f.type === "file" && f.path.toLowerCase() === target.toLowerCase());
  if (ci) return ci.path;
  const ends = files.find((f) => f.type === "file" && f.path.toLowerCase().endsWith(`/${target.toLowerCase()}`));
  if (ends) return ends.path;
  const base = files.find((f) => f.type === "file" && (f.path.split("/").pop() || "").replace(/\.md$/i, "").toLowerCase() === clean.toLowerCase());
  if (base) return base.path;
  return target;
}

export function noteExists(files: FileEntry[], href: string): boolean {
  const resolved = resolveNote(files, href);
  return files.some((f) => f.type === "file" && f.path === resolved);
}

export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;
