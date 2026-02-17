import type { GraphData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Circular layout: nodes evenly spaced on a ring, straight edges between them.

const NODE_R = 22;
const NODE_D = NODE_R * 2;
const RING_RADIUS = 100;
const PAD = 32;
const POINTER_OFFSET_Y = 36;

export function layoutGraph(data: GraphData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  // Single node: center it
  if (data.nodes.length === 1) {
    const node = data.nodes[0]!;
    const positioned: PositionedNode = {
      id: node.id,
      value: node.value,
      x: PAD,
      y: PAD,
      width: NODE_D,
      height: NODE_D,
      shape: "circle",
    };
    const pointers: PositionedPointer[] = data.pointers.map((p) => ({
      name: p.name,
      x: PAD + NODE_R,
      y: PAD + NODE_D + POINTER_OFFSET_Y,
    }));
    return {
      nodes: [positioned],
      edges: [],
      pointers,
      width: NODE_D + PAD * 2,
      height: NODE_D + PAD * 2 + (pointers.length > 0 ? POINTER_OFFSET_Y + 20 : 0),
    };
  }

  // Scale ring radius by node count so they don't overlap
  const ringR = Math.max(RING_RADIUS, data.nodes.length * (NODE_D + 8) / (2 * Math.PI));
  const cx = ringR + PAD + NODE_R;
  const cy = ringR + PAD + NODE_R;

  const nodePositions = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];

  for (let i = 0; i < data.nodes.length; i++) {
    const def = data.nodes[i]!;
    const angle = (2 * Math.PI * i) / data.nodes.length - Math.PI / 2;
    const x = cx + ringR * Math.cos(angle) - NODE_R;
    const y = cy + ringR * Math.sin(angle) - NODE_R;

    const positioned: PositionedNode = {
      id: def.id,
      value: def.value,
      x,
      y,
      width: NODE_D,
      height: NODE_D,
      shape: "circle",
    };
    nodes.push(positioned);
    nodePositions.set(def.id, positioned);
  }

  // Edges: center-to-center straight lines, shortened to circle perimeter
  const edges: PositionedEdge[] = data.edges.map((e) => {
    const from = nodePositions.get(e.fromId);
    const to = nodePositions.get(e.toId);
    const base = { id: `${e.fromId}->${e.toId}`, ...(e.weight ? { label: e.weight } : {}) };

    if (!from || !to) return { ...base, x1: 0, y1: 0, x2: 0, y2: 0 };

    const fromCx = from.x + NODE_R;
    const fromCy = from.y + NODE_R;
    const toCx = to.x + NODE_R;
    const toCy = to.y + NODE_R;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return { ...base, x1: fromCx, y1: fromCy, x2: toCx, y2: toCy };

    const ux = dx / dist;
    const uy = dy / dist;

    return {
      ...base,
      x1: fromCx + ux * NODE_R,
      y1: fromCy + uy * NODE_R,
      x2: toCx - ux * NODE_R,
      y2: toCy - uy * NODE_R,
    };
  });

  // Pointers
  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = nodePositions.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + NODE_R : PAD,
      y: (target ? target.y + NODE_D : PAD + NODE_D) + POINTER_OFFSET_Y,
    };
  });

  // Bounds
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const p of pointers) {
    maxY = Math.max(maxY, p.y + 20);
  }

  return {
    nodes,
    edges,
    pointers,
    width: maxX + PAD,
    height: maxY + PAD,
  };
}
