import { useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ActionIcon, Badge, Box, Button, Group, Tabs, Text, UnstyledButton } from "@mantine/core";
import { IconDeviceFloppy, IconDownload, IconExternalLink, IconEye, IconPencil, IconX } from "@tabler/icons-react";
import { AnimatePresence, motion } from "framer-motion";
import type { FileEntry, NoteMode, OpenTab } from "../types";
import { rawFileUrl, viewFileUrl } from "../api";
import { HTML_EXT, IMAGE_EXT, SITE_SRC, isMarkdownPath, noteExists, resolveNote } from "../lib/tree";
import { fuzzy, slugify, stripFrontmatter, vaultToMarkdown, wikilinkQueryBeforeCursor } from "../lib/wikilinks";
import { spring } from "../theme";
import { CodeBlock } from "./CodeBlock";
import { FormatBar } from "./FormatBar";
import { NoteEmbed } from "./NoteEmbed";

export function EditorPane({
  tabs,
  active,
  mode,
  files,
  onSelect,
  onClose,
  onChange,
  onSave,
  onDownload,
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
  onDownload?: () => void;
  onOpen: (p: string) => void;
  onMode: (m: NoteMode) => void;
}) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(0);
  const [sel, setSel] = useState({ start: 0, end: 0 });
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
            {HTML_EXT.test(active.path) && (
              <Button
                component="a"
                href={viewFileUrl(active.path)}
                target="_blank"
                rel="noreferrer"
                size="xs"
                radius="md"
                variant="subtle"
                color="violet"
                leftSection={<IconExternalLink size={12} />}
              >
                Open live
              </Button>
            )}
            <Tabs value={mode} onChange={(v) => onMode((v as NoteMode) || "edit")} variant="pills" radius="md" color="violet">
              <Tabs.List style={{ background: "rgba(15,15,16,0.55)", borderRadius: 8, padding: 2, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}>
                <Tabs.Tab value="edit" leftSection={<IconPencil size={12} />}>
                  Edit
                </Tabs.Tab>
                <Tabs.Tab value="preview" leftSection={<IconEye size={12} />}>
                  {HTML_EXT.test(active.path) ? "Live" : "Preview"}
                </Tabs.Tab>
              </Tabs.List>
            </Tabs>
            {onDownload && (
              <ActionIcon variant="subtle" color="gray" title="Download" onClick={onDownload}>
                <IconDownload size={14} />
              </ActionIcon>
            )}
            <Button onClick={onSave} disabled={!active.dirty} size="xs" radius="md" leftSection={<IconDeviceFloppy size={14} />} variant="gradient" gradient={{ from: "violet", to: "pink" }} style={{ opacity: active.dirty ? 1 : 0.4 }}>
              Save
            </Button>
          </Group>
        </Group>
      </Box>
      <Box style={{ flex: 1, position: "relative", overflow: "hidden", display: "flex" }}>
        <AnimatePresence mode="wait">
          {IMAGE_EXT.test(active.path) ? (
            <motion.div key="img" className="preview-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: 24 }}>
              <img src={rawFileUrl(active.path)} alt={active.path} style={{ maxWidth: "100%", borderRadius: 12 }} />
            </motion.div>
          ) : mode === "edit" ? (
            <motion.div key="edit" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring} style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              {isMarkdownPath(active.path) && (
                <FormatBar
                  value={active.content}
                  selection={sel}
                  focus={() => ta.current?.focus()}
                  onChange={(next, range) => {
                    onChange(next);
                    setSel(range);
                    setCaret(range.end);
                    requestAnimationFrame(() => ta.current?.setSelectionRange(range.start, range.end));
                  }}
                />
              )}
              <textarea
                ref={ta}
                className="editor"
                value={active.content}
                onChange={(e) => {
                  onChange(e.target.value);
                  setCaret(e.target.selectionStart);
                  setSel({ start: e.target.selectionStart, end: e.target.selectionEnd });
                }}
                onKeyUp={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  setCaret(t.selectionStart);
                  setSel({ start: t.selectionStart, end: t.selectionEnd });
                }}
                onClick={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  setCaret(t.selectionStart);
                  setSel({ start: t.selectionStart, end: t.selectionEnd });
                }}
                onSelect={(e) => {
                  const t = e.target as HTMLTextAreaElement;
                  setSel({ start: t.selectionStart, end: t.selectionEnd });
                }}
                placeholder={
                  HTML_EXT.test(active.path)
                    ? "<!DOCTYPE html>\n<html>\n  <head><link rel=\"stylesheet\" href=\"style.css\" /></head>\n  <body>\n    <script src=\"app.js\"></script>\n  </body>\n</html>"
                    : SITE_SRC.test(active.path)
                      ? "/* source */"
                      : "# Hello\n\n[[link|label]] · [web](https://…) · ```js code```"
                }
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
          ) : HTML_EXT.test(active.path) ? (
            <motion.div key="html" className="html-stage" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring}>
              {active.dirty && (
                <div className="html-preview-banner">Unsaved — linked CSS/JS load from disk after Save. Inline script still runs below.</div>
              )}
              <iframe
                key={active.dirty ? "draft" : `live:${active.saved}`}
                className="html-frame"
                title={active.path}
                sandbox="allow-scripts allow-forms allow-popups allow-modals allow-pointer-lock allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
                src={active.dirty ? undefined : viewFileUrl(active.path)}
                srcDoc={active.dirty ? active.content : undefined}
              />
            </motion.div>
          ) : SITE_SRC.test(active.path) ? (
            <motion.div key="src" className="preview-stage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring} style={{ padding: 24 }}>
              <Box className="glass md-preview" style={{ maxWidth: 920 }}>
                <CodeBlock language={active.path.split(".").pop() || "text"}>{active.content || "/* empty */"}</CodeBlock>
              </Box>
            </motion.div>
          ) : (
            <motion.div key="preview" className="preview-stage" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring}>
              <Box className="glass md-preview">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => <h1 id={slugify(String(children))}>{children}</h1>,
                    h2: ({ children }) => <h2 id={slugify(String(children))}>{children}</h2>,
                    h3: ({ children }) => <h3 id={slugify(String(children))}>{children}</h3>,
                    h4: ({ children }) => <h4 id={slugify(String(children))}>{children}</h4>,
                    pre: ({ children }) => <>{children}</>,
                    code: ({ className, children }) => {
                      const lang = /language-([\w-]+)/.exec(className || "")?.[1];
                      const text = String(children).replace(/\n$/, "");
                      if (lang || text.includes("\n")) return <CodeBlock language={lang}>{text}</CodeBlock>;
                      return <code>{children}</code>;
                    },
                    img: ({ src, alt }) => {
                      const raw = src || "";
                      const url = raw.startsWith("vault:") ? rawFileUrl(raw.slice(6)) : raw;
                      return <img src={url} alt={alt || ""} />;
                    },
                    a: ({ href, children }) => {
                      if (href?.startsWith("embed:")) {
                        return <NoteEmbed target={href.slice(6)} files={files} onOpen={onOpen} />;
                      }
                      const isWiki = href && !href.startsWith("http") && !href.startsWith("mailto:") && !href.startsWith("#");
                      if (isWiki) {
                        const [file, hash] = href.split("#");
                        const exists = file ? noteExists(files, file) : true;
                        return (
                          <span
                            className={exists ? "wiki" : "wiki is-unresolved"}
                            title={exists ? file : `Unresolved: ${file}`}
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
                        <a href={href} target="_blank" rel="noreferrer" className="ext-link">
                          {children}
                          <IconExternalLink size={12} className="ext-ico" />
                        </a>
                      );
                    },
                  }}
                >
                  {vaultToMarkdown(stripFrontmatter(active.content)) || "*Empty note*"}
                </ReactMarkdown>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </Box>
  );
}
