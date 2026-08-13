import { useEffect, useState } from "react";
import { Text } from "@mantine/core";
import { api } from "../api";
import { resolveNote } from "../lib/tree";
import type { FileEntry } from "../types";

export function NoteEmbed({
  target,
  files,
  onOpen,
}: {
  target: string;
  files: FileEntry[];
  onOpen: (p: string) => void;
}) {
  const path = resolveNote(files, target);
  const [excerpt, setExcerpt] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ content: string }>(`/api/files/content?path=${encodeURIComponent(path)}`)
      .then((r) => {
        if (!alive) return;
        const lines = r.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").split("\n").slice(0, 14);
        setExcerpt(lines.join("\n").trim());
      })
      .catch(() => {
        if (alive) setMissing(true);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <div className={`note-embed${missing ? " is-missing" : ""}`} onClick={() => !missing && onOpen(path)} role="button" tabIndex={0}>
      <div className="note-embed-label">{path.replace(/\.md$/i, "")}</div>
      {missing ? (
        <Text size="sm" c="dimmed">
          Unresolved embed
        </Text>
      ) : (
        <pre className="note-embed-body">{excerpt || "…"}</pre>
      )}
    </div>
  );
}
