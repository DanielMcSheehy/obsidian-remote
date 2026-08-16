import { useEffect, useMemo, useState } from "react";
import { Box, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IconGraph, IconPlus, IconSearch, IconFileText, IconEye, IconPencil } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import type { FileEntry } from "../types";
import { fuzzy } from "../lib/wikilinks";
import { spring } from "../theme";

type Action = { id: string; label: string; hint?: string; icon: React.ReactNode; run: () => void; score: number };

export function CommandPalette({
  open,
  files,
  onClose,
  onOpen,
  onNew,
  onNewFolder,
  onNewHtml,
  onGraph,
  onTogglePreview,
  onOpenIndex,
  onOpenAgents,
  onOpenLog,
  onUndo,
}: {
  open: boolean;
  files: FileEntry[];
  onClose: () => void;
  onOpen: (p: string) => void;
  onNew: () => void;
  onNewFolder?: () => void;
  onNewHtml?: () => void;
  onGraph: () => void;
  onTogglePreview: () => void;
  onOpenIndex?: () => void;
  onOpenAgents?: () => void;
  onOpenLog?: () => void;
  onUndo?: () => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const items = useMemo(() => {
    const notes = files
      .filter((f) => f.type === "file")
      .map((f) => ({
        id: f.path,
        label: f.path.replace(/\.md$/i, ""),
        hint: "note",
        icon: <IconFileText size={14} />,
        run: () => onOpen(f.path),
        score: fuzzy(q, f.path),
      }))
      .filter((a) => a.score > 0);
    const actions: Action[] = [
      { id: "new", label: "New note", hint: "create", icon: <IconPlus size={14} />, run: onNew, score: fuzzy(q, "new note create") || (q ? 0 : 1) },
      { id: "new-folder", label: "New folder", hint: "mkdir", icon: <IconPlus size={14} />, run: () => onNewFolder?.(), score: fuzzy(q, "new folder mkdir directory") || (q ? 0 : 1) },
      { id: "new-html", label: "New HTML page", hint: "html/", icon: <IconPlus size={14} />, run: () => onNewHtml?.(), score: fuzzy(q, "new html page css js site") || (q ? 0 : 1) },
      { id: "graph", label: "Open graph", hint: "⌘G", icon: <IconGraph size={14} />, run: onGraph, score: fuzzy(q, "graph constellation") || (q ? 0 : 1) },
      { id: "preview", label: "Toggle edit / preview", hint: "view", icon: q ? <IconEye size={14} /> : <IconPencil size={14} />, run: onTogglePreview, score: fuzzy(q, "preview edit toggle") || (q ? 0 : 1) },
      { id: "index", label: "Open index.md", hint: "catalog", icon: <IconFileText size={14} />, run: () => onOpenIndex?.(), score: fuzzy(q, "index catalog wiki") || (q ? 0 : 1) },
      { id: "agents", label: "Open AGENTS.md", hint: "schema", icon: <IconFileText size={14} />, run: () => onOpenAgents?.(), score: fuzzy(q, "agents schema karpathy") || (q ? 0 : 1) },
      { id: "log", label: "Open log.md", hint: "timeline", icon: <IconFileText size={14} />, run: () => onOpenLog?.(), score: fuzzy(q, "log timeline ingest") || (q ? 0 : 1) },
      { id: "undo", label: "Undo last change", hint: "⌘Z", icon: <IconFileText size={14} />, run: () => onUndo?.(), score: fuzzy(q, "undo revert") || (q ? 0 : 1) },
    ].filter((a) => a.score > 0);
    return [...actions, ...notes].sort((a, b) => b.score - a.score).slice(0, 18);
  }, [files, q, onOpen, onNew, onNewFolder, onNewHtml, onGraph, onTogglePreview, onOpenIndex, onOpenAgents, onOpenLog, onUndo]);

  useEffect(() => {
    if (open) {
      setQ("");
      setIdx(0);
    }
  }, [open]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIdx((i) => Math.min(items.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const hit = items[idx];
        if (hit) {
          hit.run();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, idx, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="palette-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="glass-strong palette"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={spring}
            onClick={(e) => e.stopPropagation()}
          >
            <TextInput
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Jump to a note or run a command…"
              leftSection={<IconSearch size={16} />}
              variant="unstyled"
              size="md"
              px="sm"
              py={6}
              styles={{ input: { color: "#fff" } }}
            />
            <Box style={{ borderTop: "1px solid rgba(167,139,250,0.12)", maxHeight: 360, overflow: "auto", padding: 6 }}>
              {items.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  Nothing matches
                </Text>
              )}
              {items.map((it, i) => (
                <UnstyledButton
                  key={it.id}
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => {
                    it.run();
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: i === idx ? "linear-gradient(90deg, rgba(124,58,237,0.22), rgba(124,58,237,0.06))" : "transparent",
                    border: i === idx ? "1px solid rgba(124,58,237,0.28)" : "1px solid transparent",
                  }}
                >
                  <Box c="violet.3">{it.icon}</Box>
                  <Text size="sm" style={{ flex: 1 }} truncate>
                    {it.label}
                  </Text>
                  {it.hint && (
                    <Text size="xs" c="dimmed">
                      {it.hint}
                    </Text>
                  )}
                </UnstyledButton>
              ))}
            </Box>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
