import type { SkipListData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Stacked horizontal rows. Same node at multiple levels vertically aligned.
// Dashed vertical edges connecting same-id nodes across levels.

const NODE_W = 52;
const NODE_H = 36;
const H_GAP = 40;
const V_GAP = 48;
const PAD = 24;
const POINTER_OFFSET_Y = 36;

export function layoutSkipList(data: SkipListData): Layout {
  if (data.levels.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  // Collect all unique node IDs to determine horizontal positions
  // The bottom level (lowest number) has all nodes — use it for ordering
  const bottomLevel = data.levels[data.levels.length - 1];
  const nodeOrder = bottomLevel?.nodeIds ?? [];
  const xPositions = new Map<string, number>();
  let x = PAD;
  for (const id of nodeOrder) {
    xPositions.set(id, x);
    x += NODE_W + H_GAP;
  }

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];
  const nodePositions = new Map<string, PositionedNode>();
  // Track positions per (level, nodeId) for vertical dashed edges
  const levelNodePos = new Map<string, { x: number; y: number }>();

  for (let li = 0; li < data.levels.length; li++) {
    const level = data.levels[li];
    if (!level) continue;
    const y = PAD + li * V_GAP;

    for (let ni = 0; ni < level.nodeIds.length; ni++) {
      const nodeId = level.nodeIds[ni];
      if (!nodeId) continue;
      const nodeX = xPositions.get(nodeId) ?? PAD;
      const posId = `${nodeId}@L${level.level}`;

      const positioned: PositionedNode = {
        id: posId,
        value: data.nodes.find((n) => n.id === nodeId)?.value ?? nodeId,
        x: nodeX,
        y,
        width: NODE_W,
        height: NODE_H,
      };
      nodes.push(positioned);
      nodePositions.set(posId, positioned);
      levelNodePos.set(`${level.level}:${nodeId}`, { x: nodeX + NODE_W / 2, y: y + NODE_H / 2 });

      // Horizontal edge to next node in same level
      const nextId = level.nodeIds[ni + 1];
      if (nextId) {
        const nextX = xPositions.get(nextId) ?? PAD;
        edges.push({
          id: `${posId}->${nextId}@L${level.level}`,
          x1: nodeX + NODE_W,
          y1: y + NODE_H / 2,
          x2: nextX,
          y2: y + NODE_H / 2,
        });
      }
    }
  }

  // Vertical dashed edges connecting same node across adjacent levels
  for (let li = 0; li < data.levels.length - 1; li++) {
    const upper = data.levels[li];
    const lower = data.levels[li + 1];
    if (!upper || !lower) continue;

    for (const nodeId of upper.nodeIds) {
      if (!nodeId) continue;
      if (!lower.nodeIds.includes(nodeId)) continue;
      const upperPos = levelNodePos.get(`${upper.level}:${nodeId}`);
      const lowerPos = levelNodePos.get(`${lower.level}:${nodeId}`);
      if (!upperPos || !lowerPos) continue;

      edges.push({
        id: `vert:${nodeId}@L${upper.level}->L${lower.level}`,
        x1: upperPos.x,
        y1: upperPos.y + NODE_H / 2,
        x2: lowerPos.x,
        y2: lowerPos.y - NODE_H / 2,
        style: "dashed",
      });
    }
  }

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const targetX = xPositions.get(p.targetId) ?? PAD;
    return {
      name: p.name,
      x: targetX + NODE_W / 2,
      y: PAD + data.levels.length * V_GAP + POINTER_OFFSET_Y,
    };
  });

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const p of pointers) {
    maxY = Math.max(maxY, p.y + 20);
  }

  return { nodes, edges, pointers, width: maxX + PAD, height: maxY + PAD };
}
