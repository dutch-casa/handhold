import ELK from "elkjs/lib/elk.bundled.js";
import type { DiagramState } from "@/types/lesson";
import type {
  DiagramLayout,
  PositionedDiagramNode,
  PositionedDiagramEdge,
  PositionedDiagramGroup,
} from "./layout";

// Singleton ELK instance. Reused across all layout calls.
const elk = new ELK();

const NODE_W = 72;
const NODE_H = 72;
const ICON_NODE_W = 72;
const ICON_NODE_H = 72;
const PAD = 60;
const GROUP_PAD = 28;
const ARROW_SIZE = 8;
const LABEL_CLEARANCE = 24;

// Async layout using ELK's layered algorithm with orthogonal edge routing.
// Returns positioned nodes, edges (with routed paths), and groups.
export async function layoutDiagramWithElk(state: DiagramState): Promise<DiagramLayout> {
  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": String(80 + LABEL_CLEARANCE),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(120 + LABEL_CLEARANCE),
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.padding": `[top=${PAD},left=${PAD},bottom=${PAD},right=${PAD}]`,
    },
    children: state.nodes.map((n) => {
      const size = sizeForNode(n);
      return {
        id: n.id,
        width: size.width,
        height: size.height,
      };
    }),
    edges: state.edges.map((e, i) => ({
      id: `e${i}`,
      sources: [e.fromId],
      targets: [e.toId],
    })),
  };

  const result = await elk.layout(graph);

  // Build positioned nodes.
  const nodeMap = new Map(state.nodes.map((n) => [n.id, n]));
  const nodes: PositionedDiagramNode[] = (result.children ?? []).map((child) => {
    const def = nodeMap.get(child.id);
    return {
      id: child.id,
      label: def?.label ?? child.id,
      nodeType: def?.nodeType ?? "service",
      icon: def?.icon,
      x: child.x ?? 0,
      y: child.y ?? 0,
      width: child.width ?? NODE_W,
      height: child.height ?? NODE_H,
    };
  });

  const posMap = new Map(nodes.map((n) => [n.id, n]));

  // ELK result edges include routing sections not present in input types.
  type ElkPoint = { x: number; y: number };
  type ElkSection = { startPoint: ElkPoint; endPoint: ElkPoint; bendPoints?: ElkPoint[] };
  type ElkResultEdge = { id: string; sources?: string[]; targets?: string[]; sections?: ElkSection[] };

  // Build edge index from ELK result for routing data.
  const resultEdges = (result.edges ?? []) as ElkResultEdge[];
  const elkEdgeMap = new Map<string, ElkResultEdge>();
  for (const elkEdge of resultEdges) {
    const fromId = elkEdge.sources?.[0];
    const toId = elkEdge.targets?.[0];
    if (fromId && toId) {
      elkEdgeMap.set(`${fromId}->${toId}`, elkEdge);
    }
  }

  // Build positioned edges using ELK's routed paths.
  const edges: PositionedDiagramEdge[] = state.edges.map((e) => {
    const from = posMap.get(e.fromId);
    const to = posMap.get(e.toId);
    const elkEdge = elkEdgeMap.get(`${e.fromId}->${e.toId}`);

    // Extract routing from ELK's edge sections.
    const section = elkEdge?.sections?.[0];

    if (section) {
      const start = section.startPoint;
      const end = section.endPoint;
      const bends: Array<{ x: number; y: number }> = section.bendPoints ?? [];

      // Build all points: start, bends, end.
      const allPoints = [start, ...bends, end];

      // Shorten the last segment by ARROW_SIZE for the arrowhead.
      const lastIdx = allPoints.length - 1;
      const prev = allPoints[lastIdx - 1]!;
      const last = allPoints[lastIdx]!;
      const segDx = last.x - prev.x;
      const segDy = last.y - prev.y;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy);

      let dirX = 1;
      let dirY = 0;
      let shortenedEnd = last;

      if (segLen > ARROW_SIZE) {
        dirX = segDx / segLen;
        dirY = segDy / segLen;
        shortenedEnd = {
          x: last.x - dirX * ARROW_SIZE,
          y: last.y - dirY * ARROW_SIZE,
        };
      }

      // Build SVG path.
      const pathParts = [`M ${start.x} ${start.y}`];
      for (const bend of bends) {
        pathParts.push(`L ${bend.x} ${bend.y}`);
      }
      pathParts.push(`L ${shortenedEnd.x} ${shortenedEnd.y}`);

      // Label at midpoint of the longest straight segment.
      let bestMidX = start.x;
      let bestMidY = start.y;
      let bestLen = 0;
      for (let i = 0; i < allPoints.length - 1; i++) {
        const a = allPoints[i]!;
        const b = allPoints[i + 1]!;
        const sLen = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
        if (sLen > bestLen) {
          bestLen = sLen;
          bestMidX = (a.x + b.x) / 2;
          bestMidY = (a.y + b.y) / 2;
        }
      }

      return {
        id: `${e.fromId}->${e.toId}`,
        fromId: e.fromId,
        toId: e.toId,
        label: e.label,
        pathData: pathParts.join(" "),
        endX: last.x,
        endY: last.y,
        endDirX: dirX,
        endDirY: dirY,
        labelX: bestMidX,
        labelY: bestMidY - 12,
      };
    }

    // Fallback: straight line if ELK didn't route the edge.
    const x1 = from ? from.x + from.width : 0;
    const y1 = from ? from.y + from.height / 2 : 0;
    const x2 = to ? to.x : 0;
    const y2 = to ? to.y + to.height / 2 : 0;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const dirX = len > 0 ? dx / len : 1;
    const dirY = len > 0 ? dy / len : 0;

    return {
      id: `${e.fromId}->${e.toId}`,
      fromId: e.fromId,
      toId: e.toId,
      label: e.label,
      pathData: `M ${x1} ${y1} L ${x2 - dirX * ARROW_SIZE} ${y2 - dirY * ARROW_SIZE}`,
      endX: x2,
      endY: y2,
      endDirX: dirX,
      endDirY: dirY,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2 - 12,
    };
  });

  // Build positioned groups.
  const groups: PositionedDiagramGroup[] = state.groups.map((group) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const memberId of group.memberIds) {
      const node = posMap.get(memberId);
      if (!node) continue;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height + LABEL_CLEARANCE);
    }

    if (minX === Infinity) {
      return { name: group.name, x: 0, y: 0, width: 0, height: 0 };
    }

    return {
      name: group.name,
      x: minX - GROUP_PAD,
      y: minY - GROUP_PAD - 20,
      width: maxX - minX + GROUP_PAD * 2,
      height: maxY - minY + GROUP_PAD * 2 + 20,
    };
  });

  const width = (result as { width?: number }).width ?? 0;
  const height = (result as { height?: number }).height ?? 0;

  return { nodes, edges, groups, width, height };
}

function sizeForNode(node: DiagramState["nodes"][number]): { width: number; height: number } {
  if (node.icon) {
    return { width: ICON_NODE_W, height: ICON_NODE_H };
  }
  return { width: NODE_W, height: NODE_H };
}
