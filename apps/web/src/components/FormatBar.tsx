import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { IconBold, IconCode, IconItalic, IconLink, IconPhoto, IconQuote, IconBracketsContain, IconTable } from "@tabler/icons-react";

export function FormatBar({
  value,
  selection,
  onChange,
  focus,
}: {
  value: string;
  selection: { start: number; end: number };
  onChange: (next: string, range: { start: number; end: number }) => void;
  focus: () => void;
}) {
  function apply(next: string, start: number, end: number) {
    onChange(next, { start, end });
    requestAnimationFrame(focus);
  }

  function wrap(before: string, after: string, placeholder = "text") {
    const { start, end } = selection;
    const sel = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    const a = start + before.length;
    apply(next, a, a + sel.length);
  }

  function quote() {
    const { start, end } = selection;
    const from = value.lastIndexOf("\n", start - 1) + 1;
    const to = end;
    const block = value.slice(from, to) || "quote";
    const quoted = block
      .split("\n")
      .map((line) => (line.startsWith(">") ? line : `> ${line}`))
      .join("\n");
    const next = value.slice(0, from) + quoted + value.slice(to);
    apply(next, from, from + quoted.length);
  }

  function codeBlock() {
    const { start, end } = selection;
    const sel = value.slice(start, end) || "code";
    const fence = `\`\`\`\n${sel}\n\`\`\`\n`;
    const next = value.slice(0, start) + fence + value.slice(end);
    apply(next, start + 4, start + 4 + sel.length);
  }

  function link() {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    wrap("[", `](${url})`, "label");
  }

  function table() {
    const { start, end } = selection;
    const snippet = `| Col A | Col B |\n|---|---|\n| ${value.slice(start, end) || "a"} | b |\n`;
    const next = value.slice(0, start) + snippet + value.slice(end);
    apply(next, start, start + snippet.length);
  }

  function image() {
    const url = window.prompt("Image URL or vault path", "https://");
    if (!url) return;
    const { start, end } = selection;
    const alt = value.slice(start, end) || "image";
    const snippet = url.startsWith("http") || url.startsWith("data:") ? `![${alt}](${url})` : `![[${url}]]`;
    const next = value.slice(0, start) + snippet + value.slice(end);
    apply(next, start + snippet.length, start + snippet.length);
  }

  return (
    <Group gap={2} wrap="nowrap" px="sm" py={4} className="format-bar">
      <Tooltip label="Bold">
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => wrap("**", "**", "bold")}><IconBold size={14} /></ActionIcon>
      </Tooltip>
      <Tooltip label="Italic">
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => wrap("*", "*", "italic")}><IconItalic size={14} /></ActionIcon>
      </Tooltip>
      <Tooltip label="Quote">
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={quote}><IconQuote size={14} /></ActionIcon>
      </Tooltip>
      <Tooltip label="Code block">
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={codeBlock}><IconCode size={14} /></ActionIcon>
      </Tooltip>
      <Tooltip label="Table">
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={table}><IconTable size={14} /></ActionIcon>
      </Tooltip>
      <Tooltip label="Wikilink [[note|label]]">
        <ActionIcon size="sm" variant="subtle" color="violet" onClick={() => wrap("[[", "]]", "note")}><IconBracketsContain size={14} /></ActionIcon>
      </Tooltip>
      <Tooltip label="External link">
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={link}><IconLink size={14} /></ActionIcon>
      </Tooltip>
      <Tooltip label="Image">
        <ActionIcon size="sm" variant="subtle" color="gray" onClick={image}><IconPhoto size={14} /></ActionIcon>
      </Tooltip>
    </Group>
  );
}
