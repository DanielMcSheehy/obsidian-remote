export type SuggestKind = "kw" | "clause" | "table" | "field" | "fn" | "mod" | "type" | "var" | "idx";

export type Suggestion = {
  label: string;
  hint: string;
  kind: SuggestKind;
  insert?: string;
};

export type SchemaField = { name: string; type: string };
export type SchemaIndex = { name: string; def?: string };
export type SchemaTable = { name: string; fields: SchemaField[]; indexes?: SchemaIndex[] };

export const FALLBACK_SCHEMA: SchemaTable[] = [
  {
    name: "agent",
    fields: [
      { name: "name", type: "string" },
      { name: "token", type: "string" },
      { name: "created_at", type: "datetime" },
    ],
    indexes: [{ name: "agent_name", def: "UNIQUE name" }],
  },
  {
    name: "mail",
    fields: [
      { name: "to", type: "string" },
      { name: "from", type: "string" },
      { name: "subject", type: "string" },
      { name: "body", type: "string" },
      { name: "read", type: "bool" },
      { name: "thread", type: "string" },
      { name: "created_at", type: "datetime" },
    ],
  },
  {
    name: "wiki_node",
    fields: [
      { name: "path", type: "string" },
      { name: "title", type: "string" },
      { name: "updated_at", type: "datetime" },
    ],
    indexes: [{ name: "wiki_path", def: "UNIQUE path" }],
  },
  { name: "wiki_edge", fields: [{ name: "source", type: "string" }, { name: "target", type: "string" }] },
];

const STATEMENTS = [
  "SELECT", "CREATE", "UPDATE", "UPSERT", "DELETE", "RELATE", "INSERT", "DEFINE", "REMOVE",
  "ALTER", "REBUILD", "INFO", "USE", "LET", "RETURN", "THROW", "IF", "ELSE", "FOR", "BREAK",
  "CONTINUE", "BEGIN", "COMMIT", "CANCEL", "SLEEP", "LIVE", "KILL", "SHOW", "ACCESS",
];

const CLAUSES = [
  "FROM", "WHERE", "AND", "OR", "NOT", "IN", "ORDER", "BY", "GROUP", "ALL", "LIMIT", "START",
  "SPLIT", "FETCH", "TIMEOUT", "EXPLAIN", "FULL", "WITH", "NOINDEX", "INDEX", "ONLY", "OMIT",
  "AS", "SET", "CONTENT", "MERGE", "PATCH", "UNSET", "RETURN", "BEFORE", "AFTER", "DIFF",
  "NONE", "PARALLEL", "TEMPFILES", "VERSION", "VALUE", "ON", "TABLE", "FIELD", "FIELDS",
  "COLUMNS", "EVENT", "FUNCTION", "PARAM", "ANALYZER", "USER", "LOGIN", "NAMESPACE", "NS",
  "DATABASE", "DB", "TOKEN", "SCOPE", "SEQUENCE", "ACCESS", "COMMENT", "UNIQUE", "COUNT",
  "SCHEMAFULL", "SCHEMALESS", "PERMISSIONS", "FOR", "ASSERT", "TYPE", "VALUE", "DEFAULT",
  "FLEXIBLE", "READONLY", "OVERWRITE", "IF", "NOT", "EXISTS", "DROP", "ASC", "DESC",
  "COLLATE", "NUMERIC", "RAND", "HIGHLIGHTS", "BM25", "FULLTEXT", "SEARCH", "HIGHLIGHT",
  "SCORE", "THEN", "END", "INTO", "IGNORE", "RELATION", "NORMAL", "ANY", "ROOT",
  "PASSWORD", "PASSHASH", "ROLES", "OWNER", "EDITOR", "VIEWER", "DURATION", "SESSION",
  "SIGNIN", "SIGNUP", "ALGORITHM", "KEY", "URL", "JWT", "RECORD", "TOKENIZERS", "FILTERS",
  "WHEN", "THEN", "CHANGES", "SINCE", "CONTAINS", "CONTAINSNOT", "CONTAINSALL", "CONTAINSANY",
  "INSIDE", "NOTINSIDE", "ALLINSIDE", "ANYINSIDE", "NONEINSIDE", "OUTSIDE", "INTERSECTS",
];

const TYPES = [
  "any", "array", "bool", "bytes", "datetime", "decimal", "duration", "float", "geometry",
  "int", "number", "object", "option", "range", "record", "regex", "set", "string", "uuid",
  "null", "none", "point", "line", "polygon", "multipoint", "multiline", "multipolygon",
  "collection", "feature",
];

const LITERALS = ["TRUE", "FALSE", "NONE", "NULL", "ALWAYS", "NEVER"];

const DEFINE_TARGETS = [
  "NAMESPACE", "DATABASE", "TABLE", "FIELD", "INDEX", "EVENT", "FUNCTION", "PARAM",
  "ANALYZER", "USER", "ACCESS", "SEQUENCE", "CONFIG", "API",
];

const INFO_TARGETS = ["ROOT", "NS", "NAMESPACE", "DB", "DATABASE", "TABLE", "USER"];

const VARS = ["$auth", "$session", "$token", "$before", "$after", "$input", "$parent", "$this", "$access", "$param"];

const FN: Record<string, string[]> = {
  array: [
    "add", "all", "any", "append", "at", "boolean_and", "boolean_not", "boolean_or", "boolean_xor",
    "clump", "combine", "complement", "concat", "difference", "distinct", "every", "fill", "filter",
    "filter_index", "find", "find_index", "first", "flatten", "fold", "group", "includes", "index_of",
    "insert", "intersect", "is_empty", "join", "last", "len", "logical_and", "logical_or", "logical_xor",
    "map", "matches", "max", "min", "pop", "prepend", "push", "range", "reduce", "remove", "repeat",
    "reverse", "sequence", "shuffle", "slice", "some", "sort", "sort_lexical", "sort_natural",
    "sort_natural_lexical", "swap", "transpose", "union", "windows",
  ],
  string: [
    "capitalize", "concat", "contains", "ends_with", "endsWith", "join", "len", "lowercase", "matches",
    "repeat", "replace", "reverse", "slice", "slug", "split", "starts_with", "startsWith", "trim",
    "uppercase", "words", "is_alpha", "is_alphanum", "is_ascii", "is_datetime", "is_domain", "is_email",
    "is_hexadecimal", "is_ip", "is_ipv4", "is_ipv6", "is_latitude", "is_longitude", "is_numeric",
    "is_record", "is_semver", "is_ulid", "is_url", "is_uuid",
    "is::alpha", "is::alphanum", "is::ascii", "is::datetime", "is::domain", "is::email", "is::hexadecimal",
    "is::ip", "is::ipv4", "is::ipv6", "is::latitude", "is::longitude", "is::numeric", "is::record",
    "is::semver", "is::ulid", "is::url", "is::uuid",
    "html::encode", "html::sanitize",
    "distance::levenshtein", "distance::damerau_levenshtein", "distance::hamming", "distance::osa",
    "similarity::fuzzy", "similarity::jaro", "similarity::jaro_winkler",
    "semver::compare", "semver::major", "semver::minor", "semver::patch",
    "semver::inc::major", "semver::inc::minor", "semver::inc::patch",
    "semver::set::major", "semver::set::minor", "semver::set::patch",
  ],
  time: [
    "now", "ceil", "floor", "round", "format", "group", "day", "hour", "minute", "second", "month",
    "year", "wday", "week", "yday", "unix", "micros", "millis", "nano", "timezone", "max", "min",
    "is_leap_year", "from_micros", "from_millis", "from_nanos", "from_secs", "from_unix", "from_ulid",
    "from_uuid", "from::micros", "from::millis", "from::nanos", "from::secs", "from::unix",
    "set_year", "set_month", "set_day", "set_hour", "set_minute", "set_second", "set_nanosecond",
    "epoch", "maximum", "minimum",
  ],
  math: [
    "abs", "acos", "asin", "atan", "atan2", "bottom", "ceil", "clamp", "deg2rad", "e", "fixed",
    "floor", "inf", "interquartile", "lerp", "ln", "log", "log10", "log2", "max", "mean", "median",
    "midhinge", "min", "mode", "nearestrank", "neg_inf", "percentile", "pi", "pow", "product",
    "rad2deg", "round", "sign", "sin", "spread", "sqrt", "stddev", "sum", "tan", "tau", "top", "variance",
  ],
  type: [
    "bool", "datetime", "decimal", "duration", "field", "float", "int", "number", "point", "string",
    "table", "record", "thing", "uuid", "of",
    "is_array", "is_bool", "is_bytes", "is_collection", "is_datetime", "is_decimal", "is_duration",
    "is_float", "is_geometry", "is_int", "is_line", "is_none", "is_null", "is_multiline", "is_multipoint",
    "is_multipolygon", "is_number", "is_object", "is_point", "is_polygon", "is_record", "is_string", "is_uuid",
    "is::array", "is::bool", "is::bytes", "is::datetime", "is::decimal", "is::duration", "is::float",
    "is::geometry", "is::int", "is::none", "is::null", "is::number", "is::object", "is::record",
    "is::string", "is::uuid",
  ],
  rand: ["bool", "enum", "float", "guid", "int", "string", "time", "ulid", "uuid", "uuid::v4", "uuid::v7"],
  crypto: [
    "md5", "sha1", "sha256", "sha512",
    "argon2::generate", "argon2::compare", "bcrypt::generate", "bcrypt::compare",
    "pbkdf2::generate", "pbkdf2::compare", "scrypt::generate", "scrypt::compare",
  ],
  record: ["id", "tb", "exists", "is_edge"],
  session: ["db", "id", "ip", "ns", "origin", "ac", "rd", "token"],
  http: ["get", "post", "put", "patch", "delete", "head"],
  geo: ["area", "bearing", "centroid", "distance", "hash::decode", "hash::encode"],
  object: ["entries", "from_entries", "keys", "len", "values", "is_empty", "remove", "extend"],
  parse: [
    "email::host", "email::user", "url::domain", "url::fragment", "url::host",
    "url::path", "url::port", "url::query", "url::scheme",
  ],
  search: ["score", "highlight", "offsets", "analyze"],
  duration: [
    "days", "hours", "micros", "millis", "mins", "nanos", "secs", "weeks", "years",
    "from_days", "from_hours", "from_micros", "from_millis", "from_mins", "from_nanos", "from_secs", "from_weeks",
    "max",
  ],
  value: ["diff", "patch", "chain"],
  vector: [
    "add", "subtract", "multiply", "divide", "magnitude", "normalize", "dot", "cross", "angle", "project",
    "distance::euclidean", "distance::manhattan", "distance::hamming", "distance::chebyshev",
    "similarity::cosine", "similarity::jaccard", "similarity::pearson",
  ],
  bytes: ["len"],
  encoding: ["base64::encode", "base64::decode", "cbor::encode", "cbor::decode", "json::encode", "json::decode"],
};

const STANDALONE_FNS = ["count", "not", "sleep", "rand"];
const CONST_FNS = new Set(["time::epoch", "time::maximum", "time::minimum", "math::e", "math::pi", "math::tau", "math::inf", "math::neg_inf", "duration::max"]);

const FN_MODULES = Object.keys(FN);
const ALL_FNS: string[] = [
  ...STANDALONE_FNS,
  ...FN_MODULES.flatMap((mod) => FN[mod].map((fn) => `${mod}::${fn}`)),
];

const KW_SET = new Set([...STATEMENTS, ...CLAUSES, ...LITERALS].map((k) => k.toUpperCase()));

const KW_RE = new RegExp(`\\b(${[...KW_SET].sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");
const TYPE_RE = new RegExp(`\\b(${[...TYPES].sort((a, b) => b.length - a.length).join("|")})\\b(?!::)`, "gi");
const FN_MOD_RE = new RegExp(`\\b(?:${FN_MODULES.join("|")})::[A-Za-z_][\\w:]*(?:\\(\\))?`, "g");
const STANDALONE_FN_RE = new RegExp(`\\b(?:${STANDALONE_FNS.join("|")})(?=\\s*\\()`, "g");

export const SQL_KEYWORDS = [...STATEMENTS, ...CLAUSES.filter((c) => !STATEMENTS.includes(c))];

export function highlightSurreal(src: string): string {
  const esc = src.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts: string[] = [];
  const re =
    /(\/\*[\s\S]*?\*\/)|(--[^\n]*)|('(?:\\'|[^'])*')|("(?:\\"|[^"])*")|(`(?:\\`|[^`])*`)|(d'(?:\\'|[^'])*')|(u'(?:\\'|[^'])*')|(\$[A-Za-z_][\w]*)|(\b\d+(?:\.\d+)?(?:ns|us|µs|ms|s|m|h|d|w|y)\b)|(\b\d+(?:\.\d+)?(?:dec|f)?\b)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  const paintCode = (chunk: string) =>
    chunk
      .replace(FN_MOD_RE, (k) => `<span class="sq-fn">${k}</span>`)
      .replace(STANDALONE_FN_RE, (k) => `<span class="sq-fn">${k}</span>`)
      .replace(KW_RE, (k) => `<span class="sq-kw">${k}</span>`)
      .replace(TYPE_RE, (k) => `<span class="sq-ty">${k}</span>`);
  while ((m = re.exec(esc)) !== null) {
    parts.push(paintCode(esc.slice(last, m.index)));
    if (m[1] || m[2]) parts.push(`<span class="sq-cm">${m[0]}</span>`);
    else if (m[3] || m[4] || m[5] || m[6] || m[7]) parts.push(`<span class="sq-str">${m[0]}</span>`);
    else if (m[8]) parts.push(`<span class="sq-var">${m[0]}</span>`);
    else if (m[9]) parts.push(`<span class="sq-dur">${m[0]}</span>`);
    else if (m[10]) parts.push(`<span class="sq-num">${m[0]}</span>`);
    last = m.index + m[0].length;
  }
  parts.push(paintCode(esc.slice(last)));
  return parts.join("") || " ";
}

export function wordBefore(value: string, caret: number): { start: number; word: string } {
  const t = tokenBefore(value, caret);
  return { start: t.start, word: t.word };
}

export type TokenInfo = {
  start: number;
  word: string;
  parent: string;
  trigger: "" | "." | "::" | "$";
  stmt: string;
};

export function tokenBefore(value: string, caret: number): TokenInfo {
  const before = value.slice(0, caret);
  const stmt = (before.split(";").pop() || "").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
  const dollar = before.match(/\$[A-Za-z_][\w]*$/);
  if (dollar) {
    return { start: caret - dollar[0].length, word: dollar[0], parent: "", trigger: "$", stmt };
  }
  if (before.endsWith("$")) {
    return { start: caret - 1, word: "$", parent: "", trigger: "$", stmt };
  }
  const dotted = before.match(/([A-Za-z_][\w]*)\.([A-Za-z_][\w]*)?$/);
  if (dotted) {
    return { start: caret - (dotted[2]?.length || 0), word: dotted[2] || "", parent: dotted[1], trigger: ".", stmt };
  }
  const scoped = before.match(/((?:[A-Za-z_][\w]*::)+)([A-Za-z_][\w]*)?$/);
  if (scoped) {
    return { start: caret - (scoped[2]?.length || 0), word: scoped[2] || "", parent: scoped[1].replace(/::$/, ""), trigger: "::", stmt };
  }
  const ident = before.match(/[A-Za-z_][\w]*$/);
  return { start: caret - (ident?.[0].length || 0), word: ident?.[0] || "", parent: "", trigger: "", stmt };
}

function lastKeyword(stmt: string): string {
  const words = stmt.replace(/'[^']*'|"[^"]*"/g, " ").match(/[A-Za-z_][\w]*/g) || [];
  for (let i = words.length - 1; i >= 0; i--) {
    const u = words[i].toUpperCase();
    if (KW_SET.has(u)) return u;
  }
  return "";
}

function tablesInStmt(stmt: string, known: string[]): string[] {
  const found: string[] = [];
  const re = /\b(?:FROM|UPDATE|UPSERT|DELETE|CREATE|INSERT\s+INTO)\s+(?:ONLY\s+)?([A-Za-z_][\w]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stmt)) !== null) {
    const name = m[1];
    if (name && !KW_SET.has(name.toUpperCase())) found.push(name);
  }
  const knownLower = new Set(known.map((n) => n.toLowerCase()));
  return found.filter((n) => knownLower.has(n.toLowerCase()));
}

function scoreLabel(label: string, q: string, kind?: SuggestKind): number | null {
  if (!q) return 1;
  const l = label.toLowerCase();
  const n = q.toLowerCase();
  const schema = kind === "table" || kind === "field" || kind === "idx";
  if (l === n) return schema ? -20 : 0;
  if (l.startsWith(n)) return (schema ? -8 : 10) + Math.min(l.length, 40);
  const idx = l.indexOf(n);
  if (idx >= 0) return (schema ? 20 : 40) + idx;
  const tail = l.includes("::") ? l.slice(l.lastIndexOf("::") + 2) : l;
  if (tail.startsWith(n)) return 20;
  if (tail.includes(n)) return 50;
  return null;
}

function push(out: Array<Suggestion & { _s?: number }>, item: Suggestion, q: string, boost = 0) {
  const s = scoreLabel(item.label, q, item.kind);
  if (s === null) return;
  out.push({ ...item, _s: s + boost });
}

function fnInsert(path: string): string {
  if (CONST_FNS.has(path) || path.endsWith("::epoch") || path.endsWith("::maximum") || path.endsWith("::minimum") || path.endsWith("::pi") || path.endsWith("::tau") || path.endsWith("::e") || path.endsWith("::inf") || path.endsWith("::neg_inf") || path.endsWith("::max") && path.startsWith("duration")) {
    return path;
  }
  return `${path}()`;
}

export function completeSurreal(sql: string, caret: number, tables: SchemaTable[], force = false): Suggestion[] {
  const before = sql.slice(0, caret);
  if (/(?:^|\n)--[^\n]*$/.test(before)) return [];
  const inStr = ((before.match(/(?<!\\)'/g) || []).length % 2 === 1) || ((before.match(/(?<!\\)"/g) || []).length % 2 === 1);
  if (inStr) return [];
  const tok = tokenBefore(sql, caret);
  const q = tok.word;
  const kw = lastKeyword(tok.stmt);
  const afterSpace = /[\s(]$/.test(sql.slice(0, caret));
  if (!force && !q && !tok.trigger && !afterSpace) return [];

  const known = tables.map((t) => t.name);
  const active = tablesInStmt(tok.stmt, known);
  const byName = new Map(tables.map((t) => [t.name.toLowerCase(), t]));
  const raw: Array<Suggestion & { _s?: number }> = [];
  const add = (item: Suggestion, boost = 0) => push(raw, item, q, boost);

  if (tok.trigger === "$") {
    for (const v of VARS) add({ label: v, hint: "var", kind: "var" }, -5);
    return finish(raw, 16);
  }

  if (tok.trigger === "::") {
    const mod = tok.parent.split("::")[0].toLowerCase();
    const rest = tok.parent.includes("::") ? `${tok.parent.split("::").slice(1).join("::")}::` : "";
    const fns = FN[mod] || [];
    for (const fn of fns) {
      if (rest && !fn.startsWith(rest) && !fn.toLowerCase().includes(q.toLowerCase())) continue;
      const path = `${mod}::${fn}`;
      const local = path.toLowerCase().startsWith(`${tok.parent.toLowerCase()}::`) ? path.slice(tok.parent.length + 2) : fn;
      const full = fnInsert(path);
      const insert = full === path ? local : `${local}()`;
      add({ label: path, hint: `${mod}()`, kind: "fn", insert }, -8);
    }
    if (fns.length === 0) {
      for (const m of FN_MODULES) add({ label: `${m}::`, hint: "module", kind: "mod", insert: `${m}::` }, -4);
    }
    return finish(raw, 20);
  }

  if (tok.trigger === ".") {
    const tbl = byName.get(tok.parent.toLowerCase());
    if (tbl) {
      for (const f of tbl.fields) add({ label: f.name, hint: `${tbl.name}.${f.type}`, kind: "field" }, -12);
      for (const ix of tbl.indexes || []) add({ label: ix.name, hint: "index", kind: "idx" }, -4);
    } else {
      for (const t of tables) {
        for (const f of t.fields) add({ label: f.name, hint: `${t.name}.${f.type}`, kind: "field" }, 0);
      }
    }
    return finish(raw, 20);
  }

  const wantTable = ["FROM", "UPDATE", "UPSERT", "DELETE", "CREATE", "INTO", "RELATE", "ON", "TABLE"].includes(kw);
  const wantField = ["SELECT", "WHERE", "SET", "UNSET", "SPLIT", "FETCH", "OMIT", "GROUP", "ORDER", "RETURN", "BY", "AND", "OR"].includes(kw);
  const wantType = ["TYPE", "OPTION", "ARRAY", "SET", "RECORD", "FLEXIBLE"].includes(kw);
  const wantDefine = kw === "DEFINE" || kw === "REMOVE" || kw === "ALTER";
  const wantInfo = kw === "INFO" || (kw === "FOR" && /\bINFO\b/i.test(tok.stmt));
  const stmtStart = !kw || STATEMENTS.includes(kw) && /^\s*[A-Za-z_]*$/.test(tok.stmt);

  if (wantDefine) {
    for (const t of DEFINE_TARGETS) add({ label: t, hint: "define", kind: "kw" }, -10);
  }
  if (wantInfo) {
    for (const t of INFO_TARGETS) add({ label: t, hint: "info", kind: "kw" }, -10);
    for (const t of tables) add({ label: t.name, hint: "table", kind: "table" }, -12);
  }
  if (wantType) {
    for (const t of TYPES) add({ label: t, hint: "type", kind: "type" }, -10);
    for (const t of tables) add({ label: t.name, hint: "record<table>", kind: "table" }, -6);
  }
  if (wantTable || (!q && afterSpace && ["FROM", "UPDATE", "DELETE", "CREATE", "INTO"].includes(kw))) {
    for (const t of tables) add({ label: t.name, hint: "table", kind: "table" }, -16);
  }
  if (wantField) {
    const prefer = active.length ? active.map((n) => byName.get(n.toLowerCase())).filter(Boolean) as SchemaTable[] : tables;
    for (const t of prefer) {
      for (const f of t.fields) add({ label: f.name, hint: `${t.name}.${f.type}`, kind: "field" }, -14);
    }
    if (active.length) {
      for (const t of tables) {
        if (active.some((n) => n.toLowerCase() === t.name.toLowerCase())) continue;
        for (const f of t.fields) add({ label: f.name, hint: `${t.name}.${f.type}`, kind: "field" }, 8);
      }
    }
  }

  const focused = !q && (wantTable || wantField || wantType || wantDefine || wantInfo);
  if (!focused) {
    if (stmtStart || !q || force) {
      for (const k of STATEMENTS) add({ label: k, hint: "stmt", kind: "kw" }, stmtStart ? -6 : 12);
    }
    if (q || force) {
      for (const k of CLAUSES) add({ label: k, hint: "clause", kind: "clause" }, 6);
      for (const t of TYPES) add({ label: t, hint: "type", kind: "type" }, 10);
      for (const m of FN_MODULES) add({ label: `${m}::`, hint: "module", kind: "mod", insert: `${m}::` }, 4);
      for (const fn of ALL_FNS) add({ label: fn, hint: "fn", kind: "fn", insert: fnInsert(fn) }, 8);
      for (const t of tables) add({ label: t.name, hint: "table", kind: "table" }, 2);
    }
    if (!q && afterSpace && !wantTable && !wantField && !wantType && !wantDefine) {
      for (const k of STATEMENTS) add({ label: k, hint: "stmt", kind: "kw" }, -4);
    }
  } else if (wantField) {
    for (const k of ["AND", "OR", "NOT", "IN", "CONTAINS", "CONTAINSNOT", "INSIDE", "NONE", "NULL"]) {
      add({ label: k, hint: "clause", kind: "clause" }, 4);
    }
  } else if (wantTable) {
    add({ label: "ONLY", hint: "clause", kind: "clause" }, 8);
  }

  return finish(raw, 18);
}

function finish(raw: Array<Suggestion & { _s?: number }>, limit: number): Suggestion[] {
  const seen = new Set<string>();
  return raw
    .sort((a, b) => (a._s || 99) - (b._s || 99) || a.label.localeCompare(b.label))
    .filter((n) => {
      const k = n.label.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit)
    .map(({ label, hint, kind, insert }) => ({ label, hint, kind, insert }));
}

export function threadKey(subject: string, a: string, b: string): string {
  const sub = subject.replace(/^\s*(re|fwd)\s*:\s*/i, "").trim().toLowerCase() || "untitled";
  const pair = [a, b].map((s) => s.toLowerCase()).sort().join("|");
  return `${pair}::${sub}`.slice(0, 120);
}
