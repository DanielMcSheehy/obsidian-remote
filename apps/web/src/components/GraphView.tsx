import { useEffect, useRef, useState } from "react";
import { Badge, Box, Center, Group, Text } from "@mantine/core";
import { api } from "../api";
import type { GraphPayload } from "../types";

type FGNode = { id: string; label?: string; path?: string; dangling?: boolean; degree?: number; x?: number; y?: number };
type FGLink = { source: string | FGNode; target: string | FGNode };

type ForceGraphApi = {
  graphData: (d: { nodes: FGNode[]; links: FGLink[] }) => ForceGraphApi;
  backgroundColor: (c: string) => ForceGraphApi;
  nodeLabel: (f: (n: FGNode) => string) => ForceGraphApi;
  nodeRelSize: (n: number) => ForceGraphApi;
  nodeVal: (f: (n: FGNode) => number) => ForceGraphApi;
  nodeColor: (f: (n: FGNode) => string) => ForceGraphApi;
  nodeCanvasObject: (f: (n: FGNode, ctx: CanvasRenderingContext2D, scale: number) => void) => ForceGraphApi;
  nodePointerAreaPaint: (f: (n: FGNode, color: string, ctx: CanvasRenderingContext2D) => void) => ForceGraphApi;
  linkColor: (f: (l: FGLink) => string) => ForceGraphApi;
  linkWidth: (f: (l: FGLink) => number) => ForceGraphApi;
  linkDirectionalParticles: (n: number) => ForceGraphApi;
  linkDirectionalParticleWidth: (n: number) => ForceGraphApi;
  linkDirectionalParticleColor: (f: () => string) => ForceGraphApi;
  linkDirectionalParticleSpeed: (n: number) => ForceGraphApi;
  onNodeClick: (f: (n: FGNode) => void) => ForceGraphApi;
  onNodeHover: (f: (n: FGNode | null) => void) => ForceGraphApi;
  width: (n: number) => ForceGraphApi;
  height: (n: number) => ForceGraphApi;
  d3Force?: (name: string) => { strength?: (n: number) => void } | undefined;
  _destructor?: () => void;
};

function idOf(x: string | FGNode): string {
  return typeof x === "string" ? x : x.id;
}

export default function GraphView({ onOpen }: { onOpen: (p: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<GraphPayload | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<GraphPayload>("/api/graph")
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  useEffect(() => {
    if (!ref.current || !data) return;
    ref.current.innerHTML = "";
    let cleanup: (() => void) | null = null;
    let hover: string | null = null;

    (async () => {
      try {
        const mod = await import("force-graph");
        if (!ref.current) return;
        const ForceGraph = (mod as unknown as { default: unknown }).default as unknown as () => (el: HTMLElement) => ForceGraphApi;
        // ForceGraph()(el) — not ForceGraph(el). The factory must be invoked first.
        const el = ForceGraph()(ref.current);
        const w = ref.current.clientWidth || 800;
        const h = ref.current.clientHeight || 500;
        ref.current.style.height = "100%";
        el.width(w);
        el.height(h);
        el.backgroundColor("#09090d");
        el.nodeRelSize(5);
        el.nodeVal((n) => 1 + Math.sqrt(n.degree || 0));
        el.nodeLabel((n) => n.label || n.id);
        el.nodeColor((n) => (n.dangling ? "#6b7280" : "#8b5cf6"));
        el.nodeCanvasObject((node, ctx, scale) => {
          const r = 4 + Math.sqrt(node.degree || 1) * 1.8;
          const active = hover === node.id;
          const color = node.dangling ? "#6b7280" : active ? "#e9d5ff" : "#8b5cf6";
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = active ? 22 : 12;
          ctx.fill();
          ctx.shadowBlur = 0;
          if (scale > 0.95) {
            const label = node.label || node.id.replace(/\.md$/i, "");
            ctx.font = `${Math.max(11 / scale, 9)}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = "rgba(236,234,244,0.88)";
            ctx.fillText(label, node.x || 0, (node.y || 0) + r + 3);
          }
        });
        el.nodePointerAreaPaint((node, color, ctx) => {
          const r = 8 + Math.sqrt(node.degree || 1) * 1.8;
          ctx.beginPath();
          ctx.arc(node.x || 0, node.y || 0, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        });
        el.linkColor((l) => {
          if (!hover) return "rgba(139,92,246,0.32)";
          return idOf(l.source) === hover || idOf(l.target) === hover ? "rgba(196,181,253,0.9)" : "rgba(139,92,246,0.08)";
        });
        el.linkWidth((l) => {
          if (!hover) return 1.1;
          return idOf(l.source) === hover || idOf(l.target) === hover ? 2.2 : 0.6;
        });
        el.linkDirectionalParticles(2);
        el.linkDirectionalParticleWidth(2);
        el.linkDirectionalParticleColor(() => "#c4b5fd");
        el.linkDirectionalParticleSpeed(0.005);
        el.onNodeHover((n) => {
          hover = n?.id ?? null;
        });
        el.onNodeClick((n) => onOpen(n.path || n.id));
        const charge = el.d3Force?.("charge");
        charge?.strength?.(-220);
        el.graphData({
          nodes: data.nodes.map((n) => ({ ...n })),
          links: data.edges.map((e) => ({ source: e.source, target: e.target })),
        });
        const onResize = () => {
          if (!ref.current) return;
          el.width(ref.current.clientWidth);
          el.height(ref.current.clientHeight);
        };
        window.addEventListener("resize", onResize);
        const t = window.setTimeout(onResize, 80);
        cleanup = () => {
          window.clearTimeout(t);
          window.removeEventListener("resize", onResize);
          el._destructor?.();
        };
      } catch (e) {
        setErr(String(e));
      }
    })();

    return () => {
      cleanup?.();
      if (ref.current) ref.current.innerHTML = "";
    };
  }, [data, onOpen]);

  if (err) {
    return (
      <Center style={{ flex: 1 }}>
        <Text c="red">{err}</Text>
      </Center>
    );
  }
  if (!data) {
    return (
      <Center style={{ flex: 1 }}>
        <Text c="dimmed">Loading constellation…</Text>
      </Center>
    );
  }

  return (
    <Box style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      <Group justify="space-between" p="xs" className="glass" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none" }}>
        <Group gap={8}>
          <Badge variant="gradient" gradient={{ from: "violet", to: "pink" }}>
            {data.nodes.filter((n) => !n.dangling).length} notes
          </Badge>
          <Badge variant="outline" color="gray">
            {data.edges.length} links
          </Badge>
          <Text size="xs" c="dimmed">
            click a node to open · [[wikilinks]] become edges
          </Text>
        </Group>
      </Group>
      <Box
        ref={ref}
        style={{
          flex: 1,
          minHeight: 400,
          background: "radial-gradient(ellipse 700px 460px at 50% 20%, rgba(124,58,237,0.12), transparent 62%), #09090d",
        }}
      />
    </Box>
  );
}
