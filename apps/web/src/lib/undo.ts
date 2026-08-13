export type VaultOp =
  | { kind: "write"; path: string; before: string; after: string }
  | { kind: "create"; path: string; after: string }
  | { kind: "delete"; files: Array<{ path: string; content: string }> }
  | { kind: "move"; from: string; to: string; content: string };

const MAX = 40;

export function pushOp(stack: VaultOp[], op: VaultOp): VaultOp[] {
  return [...stack, op].slice(-MAX);
}

export function describeOp(op: VaultOp | undefined): string {
  if (!op) return "Nothing to undo";
  if (op.kind === "write") return `Undo save ${op.path}`;
  if (op.kind === "create") return `Undo create ${op.path}`;
  if (op.kind === "delete") {
    const n = op.files.length;
    return n === 1 ? `Undo delete ${op.files[0].path}` : `Undo delete ${n} files`;
  }
  return `Undo move ${op.to} → ${op.from}`;
}
