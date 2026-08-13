import { Group, Text } from "@mantine/core";

export function StatusBar({
  path,
  words,
  chars,
  dirty,
  vault,
  notes,
}: {
  path: string | null;
  words: number;
  chars: number;
  dirty: boolean;
  vault: string;
  notes: number;
}) {
  return (
    <Group h="100%" px="sm" justify="space-between" wrap="nowrap" style={{ fontSize: 11, color: "#8b8798" }}>
      <Group gap={12} wrap="nowrap" style={{ overflow: "hidden" }}>
        <Text size="xs" ff="monospace" c="violet.3" truncate>
          {vault}
        </Text>
        {path && (
          <Text size="xs" truncate>
            {path}
          </Text>
        )}
        {dirty && (
          <Text size="xs" c="orange.4">
            unsaved
          </Text>
        )}
      </Group>
      <Group gap={14} wrap="nowrap">
        {path && (
          <Text size="xs">
            {words} words · {chars} chars
          </Text>
        )}
        <Text size="xs">{notes} notes</Text>
      </Group>
    </Group>
  );
}
