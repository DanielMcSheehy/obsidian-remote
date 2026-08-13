import { useState } from "react";
import { ActionIcon, Badge, Box, Group, Stack, Text, ThemeIcon, Collapse } from "@mantine/core";
import { IconBook, IconChevronDown, IconChevronRight, IconFolder, IconFolderOpen, IconTrash } from "@tabler/icons-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import type { TreeNode } from "../types";
import { spring, stagger } from "../theme";

export function SortableFile({
  node,
  depth,
  selected,
  forceOpen,
  onOpen,
  onDelete,
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  forceOpen?: boolean;
  onOpen: (p: string) => void;
  onDelete: (p: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.path,
    data: { type: node.type, path: node.path },
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };
  if (node.type === "dir") {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <FolderNode node={node} depth={depth} selected={selected} forceOpen={forceOpen} onOpen={onOpen} onDelete={onDelete} />
      </div>
    );
  }
  const active = selected === node.path;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: Math.min(depth * stagger, 0.16) }}>
      <Group
        justify="space-between"
        wrap="nowrap"
        onClick={() => onOpen(node.path)}
        className={`tree-row${active ? " is-active" : ""}`}
        style={{ marginLeft: depth * 10 }}
      >
        <Group gap={8} wrap="nowrap" style={{ overflow: "hidden" }}>
          <ThemeIcon size="xs" variant={active ? "gradient" : "light"} gradient={{ from: "violet", to: "pink" }} color={active ? "violet" : "gray"}>
            <IconBook size={12} />
          </ThemeIcon>
          <Text size="sm" truncate style={{ color: active ? "#fff" : "#d4cde4" }}>
            {node.name.replace(/\.md$/i, "")}
          </Text>
        </Group>
        <ActionIcon size="xs" variant="subtle" color="gray" onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}>
          <IconTrash size={12} />
        </ActionIcon>
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
}: {
  node: TreeNode;
  depth: number;
  selected: string | null;
  forceOpen?: boolean;
  onOpen: (p: string) => void;
  onDelete: (p: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const shown = forceOpen || open;
  return (
    <Box>
      <Group
        justify="space-between"
        wrap="nowrap"
        onClick={() => setOpen((o) => !o)}
        className="tree-row"
        style={{ marginLeft: depth * 10 }}
      >
        <Group gap={6} wrap="nowrap">
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
      <Collapse in={shown}>
        <Stack gap={2} mt={2} style={{ borderLeft: "1px solid rgba(124,58,237,0.16)", marginLeft: 12 + depth * 2, paddingLeft: 6 }}>
          {node.children.map((child) => (
            <SortableFile key={child.path} node={child} depth={depth + 1} selected={selected} forceOpen={forceOpen} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </Stack>
      </Collapse>
    </Box>
  );
}
