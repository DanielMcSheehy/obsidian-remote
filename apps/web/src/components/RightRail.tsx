import { Box, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconArrowBackUp, IconList } from "@tabler/icons-react";
import type { GraphEdge } from "../types";
import { headings } from "../lib/wikilinks";

export function RightRail({
  content,
  path,
  edges,
  onJump,
  onOpen,
}: {
  content: string;
  path: string;
  edges: GraphEdge[];
  onJump: (id: string) => void;
  onOpen: (p: string) => void;
}) {
  const outline = headings(content);
  const backlinks = edges.filter((e) => e.target === path).map((e) => e.source);
  return (
    <Box className="glass right-rail">
      <Box px="sm" py={10} style={{ borderBottom: "1px solid rgba(167,139,250,0.1)" }}>
        <Text size="xs" tt="uppercase" fw={600} c="violet.3" style={{ letterSpacing: 0.08 + "em" }}>
          <IconList size={12} style={{ marginRight: 6, verticalAlign: -2 }} />
          Outline
        </Text>
      </Box>
      <ScrollArea style={{ flex: "0 0 auto", maxHeight: "46%" }} px="xs" py={6}>
        <Stack gap={2}>
          {outline.length === 0 && (
            <Text size="xs" c="dimmed" px={6} py={8}>
              No headings
            </Text>
          )}
          {outline.map((h) => (
            <UnstyledButton
              key={`${h.level}-${h.id}`}
              onClick={() => onJump(h.id)}
              style={{ padding: "4px 8px", paddingLeft: 6 + (h.level - 1) * 10, borderRadius: 6 }}
            >
              <Text size="xs" truncate c={h.level === 1 ? "gray.2" : "dimmed"}>
                {h.text}
              </Text>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea>
      <Box px="sm" py={10} style={{ borderTop: "1px solid rgba(167,139,250,0.1)", borderBottom: "1px solid rgba(167,139,250,0.1)" }}>
        <Text size="xs" tt="uppercase" fw={600} c="violet.3" style={{ letterSpacing: 0.08 + "em" }}>
          <IconArrowBackUp size={12} style={{ marginRight: 6, verticalAlign: -2 }} />
          Backlinks
        </Text>
      </Box>
      <ScrollArea style={{ flex: 1 }} px="xs" py={6}>
        <Stack gap={2}>
          {backlinks.length === 0 && (
            <Text size="xs" c="dimmed" px={6} py={8}>
              No notes link here yet
            </Text>
          )}
          {backlinks.map((p) => (
            <UnstyledButton key={p} onClick={() => onOpen(p)} style={{ padding: "5px 8px", borderRadius: 6 }}>
              <Text size="xs" c="violet.3" truncate>
                {p.replace(/\.md$/i, "")}
              </Text>
            </UnstyledButton>
          ))}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
