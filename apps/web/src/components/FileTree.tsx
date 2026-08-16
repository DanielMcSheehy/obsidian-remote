import { useState, type ReactNode } from "react";
import { ActionIcon, Badge, Group, Stack, Text, ThemeIcon, Collapse } from "@mantine/core";
import { IconBook, IconChevronDown, IconChevronRight, IconCode, IconDownload, IconFolder, IconFolderOpen, IconFolderPlus, IconPhoto, IconPlus, IconTrash } from "@tabler/icons-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import type { TreeNode } from "../types";
import { HTML_EXT, IMAGE_EXT, SITE_SRC } from "../lib/tree";
import { spring, stagger } from "../theme";

export function SortableFile({
  node,
  depth,
  selected,
  forceOpen,
  onOpen,
  onDelete,
  onNewNote,
  onNewFolder,
  checked,
  onToggle,
  onDownload,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  forceOpen?: boolean;
  onOpen: (p: string) => void;
  onDelete: (p: string) => void;
  onNewNote?: (parent: string) => void;
  onNewFolder?: (parent: string) => void;
  checked?: Set<string>;
  onToggle?: (p: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  onDownload?: (p: string) => void;
}) {
  const drag = useDraggable({ id: node.path, data: { type: node.type, path: node.path } });
  const drop = useDroppable({ id: node.path, data: { type: node.type, path: node.path } });
  if (node.type === "dir") {
    return (
      <FolderNode
        node={node}
        depth={depth}
        selected={selected}
        forceOpen={forceOpen}
        onOpen={onOpen}
        onDelete={onDelete}
        onNewNote={onNewNote}
        onNewFolder={onNewFolder}
        checked={checked}
        onToggle={onToggle}
        onDownload={onDownload}
      />
    );
  }
  const active = selected === node.path;
  const on = !!checked?.has(node.path);
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(drag.transform),
    opacity: drag.isDragging ? 0.45 : 1,
  };
  const setRefs = (el: HTMLElement | null) => {
    drag.setNodeRef(el);
    drop.setNodeRef(el);
  };
  return (
    <div ref={setRefs} style={style} {...drag.attributes} {...drag.listeners}>
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(depth * stagger, 0.16) }}>
      <Group
        justify="space-between"
        wrap="nowrap"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) {
            e.preventDefault();
            onToggle?.(node.path, e);
            return;
          }
          onOpen(node.path);
        }}
        className={`tree-row${active ? " is-active" : ""}${on ? " is-checked" : ""}`}
        style={{ marginLeft: depth * 10 }}
      >
        <Group gap={8} wrap="nowrap" style={{ overflow: "hidden" }}>
          <input
            type="checkbox"
            className="tree-check"
            checked={on}
            onChange={() => undefined}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(node.path, e);
            }}
            aria-label={`Select ${node.name}`}
          />
          <ThemeIcon size="xs" variant={active ? "gradient" : "light"} gradient={{ from: "violet", to: "pink" }} color={active ? "violet" : IMAGE_EXT.test(node.path) ? "pink" : HTML_EXT.test(node.path) || SITE_SRC.test(node.path) ? "violet" : "gray"}>
            {IMAGE_EXT.test(node.path) ? <IconPhoto size={12} /> : HTML_EXT.test(node.path) || SITE_SRC.test(node.path) ? <IconCode size={12} /> : <IconBook size={12} />}
          </ThemeIcon>
          <Text size="sm" truncate style={{ color: active ? "#fff" : "#d4cde4" }}>
            {node.name.replace(/\.md$/i, "")}
          </Text>
        </Group>
        <Group gap={2} wrap="nowrap">
          {onDownload && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              title="Download"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDownload(node.path);
              }}
            >
              <IconDownload size={12} />
            </ActionIcon>
          )}
          <ActionIcon size="xs" variant="subtle" color="gray" onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}>
            <IconTrash size={12} />
          </ActionIcon>
        </Group>
      </Group>
    </motion.div>
    </div>
  );
}

function FolderNode({
  node,
  depth,
  selected,
  forceOpen,
  onOpen,
  onDelete,
  onNewNote,
  onNewFolder,
  checked,
  onToggle,
  onDownload,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  forceOpen?: boolean;
  onOpen: (p: string) => void;
  onDelete: (p: string) => void;
  onNewNote?: (parent: string) => void;
  onNewFolder?: (parent: string) => void;
  checked?: Set<string>;
  onToggle?: (p: string, e: { shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }) => void;
  onDownload?: (p: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const shown = forceOpen || open;
  const on = !!checked?.has(node.path);
  const drag = useDraggable({ id: node.path, data: { type: "dir", path: node.path } });
  const drop = useDroppable({ id: `folder:${node.path}`, data: { type: "dir", path: node.path } });
  const setRefs = (el: HTMLElement | null) => {
    drag.setNodeRef(el);
    drop.setNodeRef(el);
  };
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(drag.transform),
    opacity: drag.isDragging ? 0.45 : 1,
  };
  return (
    <div style={style}>
      <div ref={setRefs} {...drag.attributes} {...drag.listeners}>
      <Group
        justify="space-between"
        wrap="nowrap"
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) {
            e.preventDefault();
            onToggle?.(node.path, e);
            return;
          }
          setOpen((o) => !o);
        }}
        className={`tree-row${drop.isOver ? " is-drop" : ""}${on ? " is-checked" : ""}`}
        style={{ marginLeft: depth * 10 }}
      >
        <Group gap={6} wrap="nowrap">
          <input
            type="checkbox"
            className="tree-check"
            checked={on}
            onChange={() => undefined}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.(node.path, e);
            }}
            aria-label={`Select ${node.name}`}
          />
          <ActionIcon size="xs" variant="subtle" color="gray">
            {shown ? <IconChevronDown size={12} /> : <IconChevronRight size={12} />}
          </ActionIcon>
          <ThemeIcon size="xs" variant="light" color="violet">
            {shown ? <IconFolderOpen size={12} /> : <IconFolder size={12} />}
          </ThemeIcon>
          <Text size="sm" fw={500} style={{ color: "#c4b5fd" }}>
            {node.name}
          </Text>
          <Badge size="xs" variant="outline" color="gray" style={{ opacity: 0.6 }}>
            {node.children.length}
          </Badge>
        </Group>
        <Group gap={2} wrap="nowrap">
          {onNewNote && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              title="New note in folder"
              onClick={(e) => {
                e.stopPropagation();
                onNewNote(node.path);
              }}
            >
              <IconPlus size={12} />
            </ActionIcon>
          )}
          {onNewFolder && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              title="New folder inside"
              onClick={(e) => {
                e.stopPropagation();
                onNewFolder(node.path);
              }}
            >
              <IconFolderPlus size={12} />
            </ActionIcon>
          )}
          {onDownload && (
            <ActionIcon
              size="xs"
              variant="subtle"
              color="gray"
              title="Download folder"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDownload(node.path);
              }}
            >
              <IconDownload size={12} />
            </ActionIcon>
          )}
          <ActionIcon
            size="xs"
            variant="subtle"
            color="gray"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.path);
            }}
          >
            <IconTrash size={12} />
          </ActionIcon>
        </Group>
      </Group>
      </div>
      <Collapse in={shown}>
        <Stack gap={2} mt={2} style={{ borderLeft: "1px solid rgba(124,58,237,0.16)", marginLeft: 12 + depth * 2, paddingLeft: 6 }}>
          {node.children.map((child) => (
            <SortableFile key={child.path} node={child} depth={depth + 1} selected={selected} forceOpen={forceOpen} onOpen={onOpen} onDelete={onDelete} onNewNote={onNewNote} onNewFolder={onNewFolder} checked={checked} onToggle={onToggle} onDownload={onDownload} />
          ))}
        </Stack>
      </Collapse>
    </div>
  );
}

export function RootDrop({ children }: { children: ReactNode }) {
  const drop = useDroppable({ id: "folder:", data: { type: "dir", path: "" } });
  return (
    <div ref={drop.setNodeRef} className={drop.isOver ? "is-drop-root" : undefined} style={{ minHeight: "100%" }}>
      {children}
    </div>
  );
}
