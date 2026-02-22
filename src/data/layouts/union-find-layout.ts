import type { UnionFindData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

// Dual view: parent array on top (horizontal cells with upward arrows),
// forest below (tree layout for each connected component, side-by-side).

const CELL_GAP = 8;
const TREE_H_GAP = 24;
const TREE_V_GAP = 48;
const PAD = 24;
const POINTER_OFFSET_Y = 36;

export function layoutUnionFind(data: UnionFindData): Layout {
  if (data.elements.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  // Content-aware sizing
  const cellW = data.elements.length > 0
    ? Math.max(48, ...data.elements.map((e) => measureCellWidth(String(e), 48)))
    : 48;
  const maxElW = data.elements.length > 0
    ? Math.max(40, ...data.elements.map((e) => measureCellWidth(String(e), 40)))
    : 40;
  const NODE_R = Math.max(20, Math.ceil(maxElW / 2));
  const NODE_D = NODE_R * 2;
  const forestOffsetY = PAD + cellW + 40;

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
      x: PAD + i * (cellW + CELL_GAP),
      y: PAD,
      width: cellW,
      height: cellW,
      shape: "grid-cell",
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

  const posMap = new Map<string, PositionedNode>();
  let forestX = PAD;

  for (const rootIdx of roots) {
    const treeWidth = computeWidth(rootIdx);

    function placeNode(idx: number, bandLeft: number, bandWidth: number, depth: number): void {
      const el = data.elements[idx] ?? "";
      const x = bandLeft + bandWidth / 2 - NODE_R;
      const y = forestOffsetY + depth * TREE_V_GAP;

      const nodeId = `forest-${idx}`;
      const pos: PositionedNode = {
        id: nodeId,
        value: el,
        x,
        y,
        width: NODE_D,
        height: NODE_D,
        shape: "circle",
      };
      nodes.push(pos);
      posMap.set(nodeId, pos);

      const children = childrenOf.get(idx) ?? [];
      let childX = bandLeft + (bandWidth - (subtreeW.get(idx) ?? NODE_D)) / 2;

      for (const c of children) {
        const cw = subtreeW.get(c) ?? NODE_D;
        placeNode(c, childX, cw, depth + 1);

        const childNodeId = `forest-${c}`;
        const childNode = posMap.get(childNodeId);
        if (childNode) {
          edges.push({
            id: `${nodeId}->${childNodeId}`,
            x1: pos.x + NODE_R,
            y1: pos.y + NODE_D,
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

  // Build full lookup for pointer resolution
  for (const n of nodes) posMap.set(n.id, n);

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = posMap.get(`forest-${p.targetId}`) ?? posMap.get(`arr-${p.targetId}`);
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
