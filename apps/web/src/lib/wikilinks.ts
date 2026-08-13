export type WikiMatch = { raw: string; target: string; header?: string; alias?: string };

/** [[target]], [[target|alias]], [[target#header]], [[target#header|alias]] */
export function parseWikilinks(content: string): WikiMatch[] {
  const out: WikiMatch[] = [];
  const re = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out.push({ raw: m[0], target: m[1].trim(), header: m[2]?.trim(), alias: m[3]?.trim() });
  }
  return out;
}

export function slugify(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function wikilinksToMarkdown(content: string): string {
  return content.replace(/\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g, (_m, target: string, header: string, alias: string) => {
    const display = (alias || target).trim();
    const href = header ? `${target.trim()}#${slugify(header)}` : target.trim();
    return `[${display}](${href})`;
  });
}

export function headings(md: string): Array<{ level: number; text: string; id: string }> {
  const stripped = stripFrontmatter(md);
  const out: Array<{ level: number; text: string; id: string }> = [];
  const re = /^(#{1,6})\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const text = m[2].trim();
    out.push({ level: m[1].length, text, id: slugify(text) });
  }
  return out;
}

export function stripFrontmatter(md: string): string {
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");
}

export function wordCount(md: string): { words: number; chars: number } {
  const text = stripFrontmatter(md).replace(/```[\s\S]*?```/g, " ");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return { words, chars: md.length };
}

export function wikilinkQueryBeforeCursor(value: string, caret: number): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const idx = before.lastIndexOf("[[");
  if (idx < 0) return null;
  const close = before.indexOf("]]", idx);
  if (close !== -1) return null;
  const inner = before.slice(idx + 2);
  if (inner.includes("\n")) return null;
  return { start: idx, query: inner };
}

export function fuzzy(q: string, s: string): number {
  const needle = q.toLowerCase();
  const hay = s.toLowerCase();
  if (!needle) return 1;
  const hit = hay.indexOf(needle);
  if (hit >= 0) return 200 - hit - (hay.length - needle.length) * 0.1;
  let i = 0;
  let score = 0;
  let gap = 0;
  for (const c of hay) {
    if (c === needle[i]) {
      score += 2 - Math.min(gap, 1);
      i += 1;
      gap = 0;
      if (i === needle.length) return score;
    } else gap += 1;
  }
  return 0;
}
