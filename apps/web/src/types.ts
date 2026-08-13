export type FileEntry = {
  path: string;
  type: "file" | "dir";
  size?: number;
  mtime?: string;
};

export type TreeNode = {
  name: string;
  path: string;
  type: "file" | "dir";
  children: TreeNode[];
  entry?: FileEntry;
};

export type GraphNode = {
  id: string;
  label: string;
  path: string;
  folder?: string;
  dangling?: boolean;
  degree?: number;
};

export type GraphEdge = { source: string; target: string };

export type GraphPayload = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  vault: string;
};

export type OpenTab = {
  path: string;
  content: string;
  dirty: boolean;
};

export type NoteMode = "edit" | "preview";
export type MainView = "note" | "graph";

export type LintReport = {
  orphans: string[];
  dangling: string[];
  empty: string[];
  wikiNotes: number;
};
