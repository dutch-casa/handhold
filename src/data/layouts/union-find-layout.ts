import type { UnionFindData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Dual view: parent array on top (horizontal cells with upward arrows),
// forest below (tree layout for each connected component, side-by-side).

const CELL_W = 48;
const CELL_H = 36;
const CELL_GAP = 4;
const NODE_R = 20;
const NODE_D = NODE_R * 2;
const TREE_H_GAP = 24;
const TREE_V_GAP = 48;
const PAD = 24;
const FOREST_OFFSET_Y = 100;
const POINTER_OFFSET_Y = 36;

export function layoutUnionFind(data: UnionFindData): Layout {
  if (data.elements.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  // --- Top: parent array ---
  for (let i = 0; i < data.elements.length; i++) {
    const el = data.elements[i] ?? "";
    const parentIdx = data.parent[i] ?? i;
    const rankVal = data.rank[i] ?? 0;

    nodes.push({
      id: `arr-${i}`,
      value: el,
      x: PAD + i * (CELL_W + CELL_GAP),
      y: PAD,
      width: CELL_W,
      height: CELL_H,
      secondaryValue: `p:${parentIdx} r:${rankVal}`,
    });
  }

  // --- Bottom: forest view ---
  // Build parent → children map
  const childrenOf = new Map<number, number[]>();
  const roots: number[] = [];
  for (let i = 0; i < data.elements.length; i++) {
    const p = data.parent[i] ?? i;
    if (p === i) {
      roots.push(i);
    } else {
      const arr = childrenOf.get(p) ?? [];
      arr.push(i);
      childrenOf.set(p, arr);
    }
  }

  // Layout each tree component side-by-side
  const subtreeW = new Map<number, number>();

  function computeWidth(idx: number): number {
    const children = childrenOf.get(idx) ?? [];
    if (children.length === 0) {
      subtreeW.set(idx, NODE_D);
      return NODE_D;
    }
    let total = 0;
    for (const c of children) {
      total += computeWidth(c);
    }
    total += TREE_H_GAP * (children.length - 1);
    subtreeW.set(idx, total);
    return total;
  }

  let forestX = PAD;

  for (const rootIdx of roots) {
    const treeWidth = computeWidth(rootIdx);

    function placeNode(idx: number, bandLeft: number, bandWidth: number, depth: number): void {
      const el = data.elements[idx] ?? "";
      const x = bandLeft + bandWidth / 2 - NODE_R;
      const y = FOREST_OFFSET_Y + depth * TREE_V_GAP;

      const nodeId = `forest-${idx}`;
      nodes.push({
        id: nodeId,
        value: el,
        x,
        y,
        width: NODE_D,
        height: NODE_D,
        shape: "circle",
      });

      const children = childrenOf.get(idx) ?? [];
      let childX = bandLeft + (bandWidth - (subtreeW.get(idx) ?? NODE_D)) / 2;

      for (const c of children) {
        const cw = subtreeW.get(c) ?? NODE_D;
        placeNode(c, childX, cw, depth + 1);

        const childNodeId = `forest-${c}`;
        const parentNode = nodes.find((n) => n.id === nodeId);
        const childNode = nodes.find((n) => n.id === childNodeId);
        if (parentNode && childNode) {
          edges.push({
            id: `${nodeId}->${childNodeId}`,
            x1: parentNode.x + NODE_R,
            y1: parentNode.y + NODE_D,
            x2: childNode.x + NODE_R,
            y2: childNode.y,
          });
        }

        childX += cw + TREE_H_GAP;
      }
    }

    placeNode(rootIdx, forestX, treeWidth, 0);
    forestX += treeWidth + TREE_H_GAP * 2;
  }

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = nodes.find((n) => n.id === `forest-${p.targetId}` || n.id === `arr-${p.targetId}`);
    return {
      name: p.name,
      x: target ? target.x + target.width / 2 : PAD,
      y: (target ? target.y + target.height : PAD + NODE_D) + POINTER_OFFSET_Y,
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
