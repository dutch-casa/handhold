import type { FibonacciHeapData, TreeNodeDef } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

// Multiple trees arranged horizontally. Root nodes connected by a doubly-linked chain.
// Min pointer arrow from above. Marked nodes get dashed border.

const LEVEL_GAP = 24;
const H_GAP = 20;
const TREE_GAP = 40;
const PAD = 24;
const POINTER_OFFSET_Y = 36;

export function layoutFibonacciHeap(data: FibonacciHeapData): Layout {
  if (data.trees.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  // Uniform node radius from max content across all tree nodes
  const allValues = data.trees.flatMap((t) => t.nodes.map((n) => n.value));
  const maxValueW = allValues.length > 0
    ? Math.max(...allValues.map((v) => measureCellWidth(v, 40)))
    : 40;
  const NODE_R = Math.max(20, Math.ceil(maxValueW / 2));
  const NODE_D = NODE_R * 2;

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];
  const posMap = new Map<string, PositionedNode>();
  const markedSet = new Set(data.markedIds);
  const rootPositions: PositionedNode[] = [];
  let treeX = PAD;

  for (const tree of data.trees) {
    const nodeMap = new Map<string, TreeNodeDef>();
    for (const n of tree.nodes) nodeMap.set(n.id, n);

    // Compute subtree widths
    const subtreeW = new Map<string, number>();

    function computeWidth(id: string): number {
      const node = nodeMap.get(id);
      if (!node || node.children.length === 0) {
        subtreeW.set(id, NODE_D);
        return NODE_D;
      }
      let total = 0;
      for (const childId of node.children) {
        total += computeWidth(childId);
      }
      total += H_GAP * (node.children.length - 1);
      subtreeW.set(id, total);
      return total;
    }

    const treeWidth = computeWidth(tree.rootId);

    // Place nodes
    function placeNode(id: string, bandLeft: number, bandWidth: number, depth: number): void {
      const node = nodeMap.get(id);
      if (!node) return;

      const x = bandLeft + bandWidth / 2 - NODE_R;
      const y = PAD + depth * (NODE_D + LEVEL_GAP);
      const isMarked = markedSet.has(id);

      const pos: PositionedNode = {
        id: node.id,
        value: node.value,
        x,
        y,
        width: NODE_D,
        height: NODE_D,
        shape: "circle",
        marker: isMarked ? "marked" : undefined,
      };
      nodes.push(pos);
      posMap.set(node.id, pos);

      if (depth === 0) rootPositions.push(pos);

      if (node.children.length === 0) return;

      let childX = bandLeft + (bandWidth - (subtreeW.get(id) ?? NODE_D)) / 2;
      for (const childId of node.children) {
        const cw = subtreeW.get(childId) ?? NODE_D;
        placeNode(childId, childX, cw, depth + 1);
        childX += cw + H_GAP;
      }
    }

    placeNode(tree.rootId, treeX, treeWidth, 0);

    // Tree edges — connect circle perimeters along center-to-center line
    for (const node of tree.nodes) {
      const parentPos = posMap.get(node.id);
      if (!parentPos) continue;
      for (const childId of node.children) {
        const childPos = posMap.get(childId);
        if (!childPos) continue;
        const [x1, y1, x2, y2] = circleEdge(parentPos, childPos, NODE_R);
        edges.push({ id: `${node.id}->${childId}`, x1, y1, x2, y2 });
      }
    }

    treeX += treeWidth + TREE_GAP;
  }

  // Root chain: doubly-linked edges between consecutive roots
  for (let i = 0; i < rootPositions.length - 1; i++) {
    const cur = rootPositions[i];
    const next = rootPositions[i + 1];
    if (!cur || !next) continue;
    const [x1, y1, x2, y2] = circleEdge(cur, next, NODE_R);
    edges.push({
      id: `root-chain:${cur.id}->${next.id}`,
      x1, y1, x2, y2,
      bidirectional: true,
      style: "dashed",
    });
  }

  // Min pointer
  const pointers: PositionedPointer[] = [];
  const minNode = posMap.get(data.minId);
  if (minNode) {
    pointers.push({
      name: "min",
      x: minNode.x + NODE_R,
      y: minNode.y - POINTER_OFFSET_Y,
      angle: 180,
    });
  }

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

function circleEdge(
  a: { readonly x: number; readonly y: number },
  b: { readonly x: number; readonly y: number },
  r: number,
): [number, number, number, number] {
  const cx1 = a.x + r, cy1 = a.y + r;
  const cx2 = b.x + r, cy2 = b.y + r;
  const dx = cx2 - cx1, dy = cy2 - cy1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [cx1, cy1, cx2, cy2];
  const ux = dx / len, uy = dy / len;
  return [cx1 + ux * r, cy1 + uy * r, cx2 - ux * r, cy2 - uy * r];
}
