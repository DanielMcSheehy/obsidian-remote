import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Group, Text } from "@mantine/core";
import { api } from "../api";
import { FALLBACK_SCHEMA, completeSurreal, highlightSurreal, tokenBefore, type SchemaTable } from "../lib/surrealql";

const STARTER = `SELECT * FROM wiki_node LIMIT 25;
-- SELECT * FROM wiki_edge;
-- SELECT * FROM agent;
-- SELECT * FROM mail ORDER BY created_at DESC LIMIT 20;`;

export function SurrealStudio() {
  const [sql, setSql] = useState(STARTER);
  const [out, setOut] = useState("Run a query against the file-backed Surreal store.");
  const [busy, setBusy] = useState(false);
  const [tables, setTables] = useState<SchemaTable[]>(FALLBACK_SCHEMA);
  const [openTbl, setOpenTbl] = useState<string | null>("wiki_node");
  const [caret, setCaret] = useState(0);
  const [pick, setPick] = useState(0);
  const [forced, setForced] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    api<{ tables: SchemaTable[] }>("/api/surreal/schema")
      .then((r) => {
        if (r.tables?.length) setTables(r.tables);
      })
      .catch(() => {
        /* keep fallback tables so autocomplete still works */
      });
  }, []);

  const suggestions = useMemo(() => completeSurreal(sql, caret, tables, forced), [sql, caret, tables, forced]);
  useEffect(() => {
    if (pick >= suggestions.length) setPick(0);
  }, [pick, suggestions.length]);

  function syncScroll() {
    if (ta.current && pre.current) {
      pre.current.scrollTop = ta.current.scrollTop;
      pre.current.scrollLeft = ta.current.scrollLeft;
    }
  }

  function insert(text: string) {
    const start = tokenBefore(sql, caret).start;
    const next = sql.slice(0, start) + text + sql.slice(caret);
    const pos = start + text.length;
    setSql(next);
    setCaret(pos);
    setForced(false);
    setPick(0);
    requestAnimationFrame(() => {
      ta.current?.focus();
      ta.current?.setSelectionRange(pos, pos);
    });
  }

  async function run() {
    setBusy(true);
    try {
      const r = await api<{ result: unknown }>("/api/surreal/query", { method: "POST", body: JSON.stringify({ sql }) });
      setOut(JSON.stringify(r.result, null, 2));
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="studio studio-split">
      <aside className="schema-rail">
        <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={6}>
          Schema
        </Text>
        {tables.length === 0 && (
          <Text size="xs" c="dimmed">
            Load Surreal to see live INFO FOR DB. Showing nothing yet.
          </Text>
        )}
        {tables.map((t) => (
          <div key={t.name} className="schema-tbl">
            <button
              type="button"
              className={`schema-tbl-name${openTbl === t.name ? " is-on" : ""}`}
              onClick={() => {
                setOpenTbl(openTbl === t.name ? null : t.name);
                setSql(`SELECT * FROM ${t.name} LIMIT 25;\n`);
              }}
            >
              {t.name}
              <span>{t.fields.length}</span>
            </button>
            {openTbl === t.name && (
              <ul className="schema-fields">
                {t.fields.map((f) => (
                  <li key={f.name}>
                    <button type="button" onClick={() => insert(f.name)}>
                      <code>{f.name}</code>
                      <em>{f.type}</em>
                    </button>
                  </li>
                ))}
                {(t.indexes || []).map((ix) => (
                  <li key={`ix-${ix.name}`}>
                    <button type="button" onClick={() => insert(ix.name)}>
                      <code>{ix.name}</code>
                      <em>index</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </aside>
      <div className="studio-main">
        <Group justify="space-between">
          <div>
            <Text fw={600}>Surreal</Text>
            <Text size="xs" c="dimmed">
              File-backed RocksDB · ns vault · db memory · Tab complete · Ctrl+Space · ⌘Enter run
            </Text>
          </div>
          <Button size="xs" variant="gradient" gradient={{ from: "violet", to: "pink" }} loading={busy} onClick={run}>
            Run
          </Button>
        </Group>
        <div className="sql-wrap">
          <pre ref={pre} className="sql-hi" aria-hidden dangerouslySetInnerHTML={{ __html: highlightSurreal(sql) + "\n" }} />
          <textarea
            ref={ta}
            className="sql-ed"
            value={sql}
            onChange={(e) => {
              setSql(e.target.value);
              setCaret(e.target.selectionStart);
              setPick(0);
              setForced(false);
            }}
            onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
            onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
            onScroll={syncScroll}
            spellCheck={false}
            onKeyDown={(e) => {
              const chosen = suggestions[pick] || suggestions[0];
              const accept = chosen ? chosen.insert || chosen.label : "";
              const typed = tokenBefore(sql, caret).word;
              if (e.key === " " && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                setForced(true);
                setPick(0);
                return;
              }
              if (suggestions.length && e.key === "Tab" && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
                insert(accept);
                return;
              }
              if (suggestions.length && e.key === "Enter" && !e.metaKey && !e.ctrlKey && (typed || forced)) {
                e.preventDefault();
                insert(accept);
                return;
              }
              if (e.key === "ArrowDown" && suggestions.length) {
                e.preventDefault();
                setPick((i) => Math.min(suggestions.length - 1, i + 1));
                return;
              }
              if (e.key === "ArrowUp" && suggestions.length) {
                e.preventDefault();
                setPick((i) => Math.max(0, i - 1));
                return;
              }
              if (e.key === "Escape") {
                setForced(false);
                setPick(0);
              }
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void run();
              }
            }}
          />
          {suggestions.length > 0 && (
            <div className="sql-ac">
              {suggestions.map((s, i) => (
                <button
                  key={`${s.kind}-${s.label}`}
                  type="button"
                  className={`${i === pick ? "is-on" : ""} is-${s.kind}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insert(s.insert || s.label);
                  }}
                >
                  <span>{s.label}</span>
                  <em>{s.hint}</em>
                </button>
              ))}
            </div>
          )}
        </div>
        <pre className="studio-out">{out}</pre>
      </div>
    </div>
  );
}
