const KW =
  /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|ORDER|BY|GROUP|LIMIT|START|SPLIT|FETCH|TIMEOUT|EXPLAIN|CREATE|UPDATE|DELETE|RELATE|INSERT|UPSERT|DEFINE|REMOVE|INFO|USE|NS|DB|TABLE|FIELD|INDEX|EVENT|SCOPE|TOKEN|USER|LOGIN|NAMESPACE|DATABASE|TYPE|ASSERT|PERMISSIONS|FOR|FULL|NONE|SCHEMAFULL|SCHEMALESS|UNIQUE|ON|AS|SET|CONTENT|MERGE|PATCH|RETURN|BEFORE|AFTER|DIFF|NONE|PARALLEL|SLEEP|LET|IF|ELSE|THEN|END|FOR|BREAK|CONTINUE|FUNCTION|PARAM|ANALYZER|SEARCH|HIGHLIGHT|SCORE|BEGIN|COMMIT|CANCEL|TRANSACTION|LIVE|KILL|SHOW|CHANGES|SINCE)\b/gi;

export function highlightSurreal(src: string): string {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts: string[] = [];
  const re = /(\/\*[\s\S]*?\*\/)|(--[^\n]*)|('(?:\\'|[^'])*')|("(?:\\"|[^"])*")|(`(?:\\`|[^`])*`)|(\$[A-Za-z_][\w]*)|(\b\d+(?:\.\d+)?\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const paintKw = (chunk: string) =>
    chunk.replace(KW, (k) => `<span class="sq-kw">${k}</span>`);
  while ((m = re.exec(esc)) !== null) {
    parts.push(paintKw(esc.slice(last, m.index)));
    if (m[1] || m[2]) parts.push(`<span class="sq-cm">${m[0]}</span>`);
    else if (m[3] || m[4] || m[5]) parts.push(`<span class="sq-str">${m[0]}</span>`);
    else if (m[6]) parts.push(`<span class="sq-var">${m[0]}</span>`);
    else if (m[7]) parts.push(`<span class="sq-num">${m[0]}</span>`);
    last = m.index + m[0].length;
  }
  parts.push(paintKw(esc.slice(last)));
  return parts.join("") || " ";
}

export function threadKey(subject: string, a: string, b: string): string {
  const sub = subject.replace(/^\s*(re|fwd)\s*:\s*/i, "").trim().toLowerCase() || "untitled";
  const pair = [a, b].map((s) => s.toLowerCase()).sort().join("|");
  return `${pair}::${sub}`.slice(0, 120);
}
