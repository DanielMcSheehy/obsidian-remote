import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ActionIcon, Badge, Box, Button, Group, Tabs, Text, UnstyledButton } from "@mantine/core";
import { IconDeviceFloppy, IconEye, IconPencil, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import type { FileEntry, NoteMode, OpenTab } from "../types";
import { resolveNote } from "../lib/tree";
import { fuzzy, slugify, stripFrontmatter, wikilinkQueryBeforeCursor, wikilinksToMarkdown } from "../lib/wikilinks";
import { spring } from "../theme";

export function EditorPane({
  tabs,
  active,
  mode,
  files,
  onSelect,
  onClose,
  onChange,
  onSave,
  onOpen,
  onMode,
}: {
  tabs: OpenTab[];
  active: OpenTab;
  mode: NoteMode;
  files: FileEntry[];
  onSelect: (p: string) => void;
  onClose: (p: string) => void;
  onChange: (content: string) => void;
  onSave: () => void;
  onOpen: (p: string) => void;
  onMode: (m: NoteMode) => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const wiki = mode === "edit" ? wikilinkQueryBeforeCursor(active.content, caret) : null;
  const suggestions = useMemo(() => {
    if (!wiki) return [];
    return files
      .filter((f) => f.type === "file")
      .map((f) => ({ path: f.path, score: fuzzy(wiki.query, f.path) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [files, wiki]);

  function insertWiki(path: string) {
    if (!wiki) return;
    const name = path.replace(/\.md$/i, "");
    const next = active.content.slice(0, wiki.start) + `[[${name}]]` + active.content.slice(caret);
    onChange(next);
    requestAnimationFrame(() => {
      const pos = wiki.start + name.length + 4;
      ta.current?.focus();
      ta.current?.setSelectionRange(pos, pos);
      setCaret(pos);
    });
  }

  const crumbs = active.path.replace(/\.md$/i, "").split("/");

  return (
    <Box style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
      <Box className="glass" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
        <div className="tab-row">
          {tabs.map((t) => {
            const on = t.path === active.path;
            return (
              <div key={t.path} className={`note-tab${on ? " active" : ""}`} onClick={() => onSelect(t.path)}>
                {t.dirty && <span className="dot" />}
                <span>{(t.path.split("/").pop() || t.path).replace(/\.md$/i, "")}</span>
                <ActionIcon
                  size={16}
                  variant="subtle"
                  color="gray"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(t.path);
                  }}
                >
                  <IconX size={11} />
                </ActionIcon>
              </div>
            );
          })}
        </div>
        <Group justify="space-between" px="sm" py={6} wrap="nowrap" style={{ borderTop: "1px solid rgba(167,139,250,0.1)" }}>
          <Group gap={6} wrap="nowrap" style={{ overflow: "hidden" }}>
            <Badge variant="gradient" gradient={{ from: "violet", to: "pink" }} size="sm">
              {active.path}
            </Badge>
            <Text className="crumb" visibleFrom="md">
              {crumbs.join("  /  ")}
            </Text>
            {active.dirty && (
              <Badge color="orange" variant="dot" size="sm">
                unsaved
              </Badge>
            )}
          </Group>
          <Group gap={6} wrap="nowrap">
            <Tabs value={mode} onChange={(v) => onMode((v as NoteMode) || "edit")} variant="pills" radius="md" color="violet">
              <Tabs.List style={{ background: "rgba(15,15,16,0.55)", borderRadius: 8, padding: 2, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
                <Tabs.Tab value="edit" leftSection={<IconPencil size={12} />}>
                  Edit
                </Tabs.Tab>
                <Tabs.Tab value="preview" leftSection={<IconEye size={12} />}>
                  Preview
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>
            <Button onClick={onSave} disabled={!active.dirty} size="xs" radius="md" leftSection={<IconDeviceFloppy size={14} />} variant="gradient" gradient={{ from: "violet", to: "pink" }} style={{ opacity: active.dirty ? 1 : 0.4 }}>
              Save
            </Button>
          </Group>
        </Group>
      </Box>
      <Box style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>
        <AnimatePresence mode="wait">
          {mode === "edit" ? (
            <motion.div key="edit" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring} style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <textarea
                ref={ta}
                className="editor"
                value={active.content}
                onChange={(e) => {
                  onChange(e.target.value);
                  setCaret(e.target.selectionStart);
                }}
                onKeyUp={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
                onClick={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart)}
                placeholder={"# Hello\n\n[[link]] to another note — it will show in the graph."}
                spellCheck={false}
              />
              <AnimatePresence>
                {wiki && suggestions.length > 0 && (
                  <motion.div className="glass-strong wiki-suggest" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={spring}>
                    {suggestions.map((s) => (
                      <UnstyledButton
                        key={s.path}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertWiki(s.path);
                        }}
                        style={{ display: "block", width: "100%", padding: "8px 12px", textAlign: "left" }}
                      >
                        <Text size="sm" c="violet.2">
                          {s.path.replace(/\.md$/i, "")}
                        </Text>
                      </UnstyledButton>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div key="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring} style={{ flex: 1, overflow: "auto" }}>
              <Box className="glass md-preview" style={{ margin: "20px auto 40px", borderRadius: 16 }}>
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 id={slugify(String(children))}>{children}</h1>,
                    h2: ({ children }) => <h2 id={slugify(String(children))}>{children}</h2>,
                    h3: ({ children }) => <h3 id={slugify(String(children))}>{children}</h3>,
                    h4: ({ children }) => <h4 id={slugify(String(children))}>{children}</h4>,
                    a: ({ href, children }) => {
                      const isWiki = href && !href.startsWith("http") && !href.startsWith("mailto:");
                      if (isWiki) {
                        const [file, hash] = href.split("#");
                        return (
                          <span
                            className="wiki"
                            onClick={() => {
                              if (file) onOpen(resolveNote(files, file));
                              if (hash) {
                                requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }));
                              }
                            }}
                          >
                            {children}
                          </span>
                        );
                      }
                      return (
                        <a href={href} target="_blank" rel="noreferrer">
                          {children}
                        </a>
                      );
                    },
                  }}
                >
                  {wikilinksToMarkdown(stripFrontmatter(active.content)) || "*Empty note*"}
                </ReactMarkdown>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
