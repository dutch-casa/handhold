import type { DiagramState, DiagramNodeDef } from "@/types/lesson";

// Auto-layout for diagrams via topological sort + layered positioning.
// Pure function: DiagramState → positioned nodes/edges/groups.

export type DiagramLayout = {
  readonly nodes: readonly PositionedDiagramNode[];
  readonly edges: readonly PositionedDiagramEdge[];
  readonly groups: readonly PositionedDiagramGroup[];
  readonly width: number;
  readonly height: number;
};

export type PositionedDiagramNode = {
  readonly id: string;
  readonly label: string;
  readonly nodeType: string;
  readonly icon?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type PositionedDiagramEdge = {
  readonly id: string;
  readonly fromId: string;
  readonly toId: string;
  readonly label: string;
  // SVG path data for the edge route (includes bend points from ELK)
  readonly pathData: string;
  // Endpoint for the arrowhead
  readonly endX: number;
  readonly endY: number;
  // Direction vector at the endpoint (for arrowhead orientation)
  readonly endDirX: number;
  readonly endDirY: number;
  // Label position
  readonly labelX: number;
  readonly labelY: number;
};

export type PositionedDiagramGroup = {
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

// --- Constants ---

const NODE_W = 140;
const NODE_H = 56;
const H_GAP = 80;
const V_GAP = 60;
const PAD = 40;
const GROUP_PAD = 20;

// --- Main entry ---

export function layoutDiagram(state: DiagramState): DiagramLayout {
  const layers = assignLayers(state);
  const nodePositions = positionNodes(layers, state.nodes);
  const edges = positionEdges(state, nodePositions);
  const groups = positionGroups(state, nodePositions);

  let maxX = 0;
  let maxY = 0;
  for (const n of nodePositions.values()) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const g of groups) {
    maxX = Math.max(maxX, g.x + g.width);
    maxY = Math.max(maxY, g.y + g.height);
  }

  return {
    nodes: [...nodePositions.values()],
    edges,
    groups,
    width: maxX + PAD,
    height: maxY + PAD,
  };
}

// --- Layer assignment via topological sort ---
// Nodes with no incoming edges go to layer 0.
// Each other node goes to max(parent layers) + 1.

function assignLayers(state: DiagramState): Map<number, string[]> {
  const nodeIds = new Set(state.nodes.map((n) => n.id));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of state.edges) {
    if (!nodeIds.has(edge.fromId) || !nodeIds.has(edge.toId)) continue;
    adjacency.get(edge.fromId)!.push(edge.toId);
    inDegree.set(edge.toId, (inDegree.get(edge.toId) ?? 0) + 1);
  }

  // BFS layer assignment
  const layerOf = new Map<string, number>();
  const queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) {
      queue.push(id);
      layerOf.set(id, 0);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const current = queue[head]!;
    head++;
    const currentLayer = layerOf.get(current) ?? 0;
    const neighbors = adjacency.get(current) ?? [];

    for (const neighbor of neighbors) {
      const existing = layerOf.get(neighbor);
      const newLayer = currentLayer + 1;
      if (existing === undefined || newLayer > existing) {
        layerOf.set(neighbor, newLayer);
      }
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Handle cycles / disconnected nodes — assign to layer 0
  for (const id of nodeIds) {
    if (!layerOf.has(id)) {
      layerOf.set(id, 0);
    }
  }

  // Group by layer
  const layers = new Map<number, string[]>();
  for (const [id, layer] of layerOf) {
    const existing = layers.get(layer);
    if (existing) {
      existing.push(id);
    } else {
      layers.set(layer, [id]);
    }
  }

  return layers;
}

// --- Position nodes in grid ---

function positionNodes(
  layers: Map<number, string[]>,
  nodeDefs: readonly DiagramNodeDef[],
): Map<string, PositionedDiagramNode> {
  const nodeMap = new Map(nodeDefs.map((n) => [n.id, n]));
  const result = new Map<string, PositionedDiagramNode>();

  const sortedLayers = [...layers.entries()].sort(([a], [b]) => a - b);

  for (const [layerIdx, ids] of sortedLayers) {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i]!;
      const def = nodeMap.get(id);
      if (!def) continue;

      result.set(id, {
        id: def.id,
        label: def.label,
        nodeType: def.nodeType,
        x: PAD + layerIdx * (NODE_W + H_GAP),
        y: PAD + i * (NODE_H + V_GAP),
        width: NODE_W,
        height: NODE_H,
      });
    }
  }

  return result;
}

// --- Position edges ---

const ARROW_SIZE = 8;

function positionEdges(
  state: DiagramState,
  nodePositions: Map<string, PositionedDiagramNode>,
): PositionedDiagramEdge[] {
  return state.edges.flatMap((edge) => {
    const from = nodePositions.get(edge.fromId);
    const to = nodePositions.get(edge.toId);
    if (!from || !to) return [];

    const x1 = from.x + from.width;
    const y1 = from.y + from.height / 2;
    const x2 = to.x;
    const y2 = to.y + to.height / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const dirX = len > 0 ? dx / len : 1;
    const dirY = len > 0 ? dy / len : 0;

    return [{
      id: `${edge.fromId}->${edge.toId}`,
      fromId: edge.fromId,
      toId: edge.toId,
      label: edge.label,
      pathData: `M ${x1} ${y1} L ${x2 - dirX * ARROW_SIZE} ${y2 - dirY * ARROW_SIZE}`,
      endX: x2,
      endY: y2,
      endDirX: dirX,
      endDirY: dirY,
      labelX: (x1 + x2) / 2,
      labelY: (y1 + y2) / 2 - 12,
    }];
  });
}

// --- Position groups ---

function positionGroups(
  state: DiagramState,
  nodePositions: Map<string, PositionedDiagramNode>,
): PositionedDiagramGroup[] {
  return state.groups.map((group) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const memberId of group.memberIds) {
      const node = nodePositions.get(memberId);
      if (!node) continue;
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x + node.width);
      maxY = Math.max(maxY, node.y + node.height);
    }

    if (minX === Infinity) {
      return { name: group.name, x: 0, y: 0, width: 0, height: 0 };
    }

    return {
      name: group.name,
      x: minX - GROUP_PAD,
      y: minY - GROUP_PAD - 20, // room for label
      width: maxX - minX + GROUP_PAD * 2,
      height: maxY - minY + GROUP_PAD * 2 + 20,
    };
  });
}
