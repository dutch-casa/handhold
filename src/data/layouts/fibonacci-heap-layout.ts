import type { FibonacciHeapData, TreeNodeDef } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Multiple trees arranged horizontally. Root nodes connected by a doubly-linked chain.
// Min pointer arrow from above. Marked nodes get dashed border.

const NODE_R = 20;
const NODE_D = NODE_R * 2;
const V_GAP = 48;
const H_GAP = 20;
const TREE_GAP = 40;
const PAD = 24;
const POINTER_OFFSET_Y = 36;

export function layoutFibonacciHeap(data: FibonacciHeapData): Layout {
  if (data.trees.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];
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
      const y = PAD + depth * V_GAP;
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

    // Tree edges
    for (const node of tree.nodes) {
      const parentPos = nodes.find((n) => n.id === node.id);
      if (!parentPos) continue;
      for (const childId of node.children) {
        const childPos = nodes.find((n) => n.id === childId);
        if (!childPos) continue;
        edges.push({
          id: `${node.id}->${childId}`,
          x1: parentPos.x + NODE_R,
          y1: parentPos.y + NODE_D,
          x2: childPos.x + NODE_R,
          y2: childPos.y,
        });
      }
    }

    treeX += treeWidth + TREE_GAP;
  }

  // Root chain: horizontal doubly-linked edges between consecutive roots
  for (let i = 0; i < rootPositions.length - 1; i++) {
    const cur = rootPositions[i];
    const next = rootPositions[i + 1];
    if (!cur || !next) continue;
    edges.push({
      id: `root-chain:${cur.id}->${next.id}`,
      x1: cur.x + NODE_D,
      y1: cur.y + NODE_R,
      x2: next.x,
      y2: next.y + NODE_R,
      bidirectional: true,
      style: "dashed",
    });
  }

  // Min pointer
  const pointers: PositionedPointer[] = [];
  const minNode = nodes.find((n) => n.id === data.minId);
  if (minNode) {
    pointers.push({
      name: "min",
      x: minNode.x + NODE_R,
      y: minNode.y - POINTER_OFFSET_Y,
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
