import { useRef, useState } from "react";
import { Button, Group, Text } from "@mantine/core";
import { api } from "../api";
import { highlightSurreal } from "../lib/surrealql";

const STARTER = `SELECT * FROM wiki_node LIMIT 25;
-- SELECT * FROM wiki_edge;
-- SELECT * FROM agent;
-- SELECT * FROM mail ORDER BY created_at DESC LIMIT 20;`;

export function SurrealStudio() {
  const [sql, setSql] = useState(STARTER);
  const [out, setOut] = useState("Run a query against the file-backed Surreal store.");
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const pre = useRef<HTMLPreElement>(null);

  function syncScroll() {
    if (ta.current && pre.current) {
      pre.current.scrollTop = ta.current.scrollTop;
      pre.current.scrollLeft = ta.current.scrollLeft;
    }
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
    <div className="studio">
      <Group justify="space-between">
        <div>
          <Text fw={600}>Surreal</Text>
          <Text size="xs" c="dimmed">
            File-backed RocksDB · ns vault · db memory · wiki_node / wiki_edge / agent / mail
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
          onChange={(e) => setSql(e.target.value)}
          onScroll={syncScroll}
          spellCheck={false}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
        />
      </div>
      <pre className="studio-out">{out}</pre>
    </div>
  );
}
