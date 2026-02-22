import type { BTreeData, BTreeNodeDef } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

// Wide-node tree: each node contains multiple keys side by side.
// Bottom-up subtree width algorithm, same as n-ary tree.

const KEY_PAD = 12;
const NODE_H = 44;
const LEVEL_GAP = 24;
const H_GAP = 32;
const PAD = 24;
const POINTER_OFFSET_Y = 36;

export function layoutBTree(data: BTreeData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  // Uniform key width from max content across all keys in the tree
  const allKeys = data.nodes.flatMap((n) => n.keys);
  const keyW = allKeys.length > 0
    ? Math.max(40, ...allKeys.map((k) => measureCellWidth(k, 40)))
    : 40;

  function nodeWidth(node: BTreeNodeDef): number {
    return Math.max(keyW, node.keys.length * keyW + KEY_PAD * 2);
  }

  const nodeMap = new Map<string, BTreeNodeDef>();
  for (const n of data.nodes) nodeMap.set(n.id, n);

  const root = nodeMap.get(data.rootId);
  if (!root) return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };

  // Compute subtree widths
  const subtreeWidth = new Map<string, number>();

  function computeWidth(id: string): number {
    const node = nodeMap.get(id);
    if (!node) return 0;
    if (node.children.length === 0) {
      const w = nodeWidth(node);
      subtreeWidth.set(id, w);
      return w;
    }
    let total = 0;
    for (const childId of node.children) {
      total += computeWidth(childId);
    }
    total += H_GAP * (node.children.length - 1);
    const ownW = nodeWidth(node);
    const w = Math.max(ownW, total);
    subtreeWidth.set(id, w);
    return w;
  }

  const totalWidth = computeWidth(data.rootId);

  const positioned: PositionedNode[] = [];
  const posMap = new Map<string, PositionedNode>();

  function assignPositions(id: string, bandLeft: number, bandWidth: number, depth: number): void {
    const node = nodeMap.get(id);
    if (!node) return;

    const w = nodeWidth(node);
    const x = bandLeft + bandWidth / 2 - w / 2;
    const y = PAD + depth * (NODE_H + LEVEL_GAP);

    // Render keys as a single wide-rect node with joined key labels
    const pos: PositionedNode = {
      id: node.id,
      value: node.keys.join(" | "),
      x,
      y,
      width: w,
      height: NODE_H,
      shape: "wide-rect",
    };
    positioned.push(pos);
    posMap.set(node.id, pos);

    if (node.children.length === 0) return;

    let childX = bandLeft + (bandWidth - (subtreeWidth.get(id) ?? w)) / 2;
    for (const childId of node.children) {
      const childWidth = subtreeWidth.get(childId) ?? keyW;
      assignPositions(childId, childX, childWidth, depth + 1);
      childX += childWidth + H_GAP;
    }
  }

  assignPositions(data.rootId, PAD, totalWidth, 0);

  // Edges: parent bottom → child top
  const edges: PositionedEdge[] = [];
  for (const node of data.nodes) {
    const parentPos = posMap.get(node.id);
    if (!parentPos) continue;

    for (let ci = 0; ci < node.children.length; ci++) {
      const childId = node.children[ci];
      if (!childId) continue;
      const childPos = posMap.get(childId);
      if (!childPos) continue;

      // Distribute edge start points across the parent's width
      const edgeX = parentPos.x + ((ci + 1) / (node.children.length + 1)) * parentPos.width;
      edges.push({
        id: `${node.id}->${childId}`,
        x1: edgeX,
        y1: parentPos.y + NODE_H,
        x2: childPos.x + childPos.width / 2,
        y2: childPos.y,
      });
    }
  }

  // B+ tree leaf links: horizontal arrows between consecutive leaf nodes
  if (data.leafLinks) {
    const leaves = data.nodes.filter((n) => n.children.length === 0);
    for (let i = 0; i < leaves.length - 1; i++) {
      const cur = leaves[i];
      const next = leaves[i + 1];
      if (!cur || !next) continue;
      const curPos = posMap.get(cur.id);
      const nextPos = posMap.get(next.id);
      if (!curPos || !nextPos) continue;
      edges.push({
        id: `leaf-link:${cur.id}->${next.id}`,
        x1: curPos.x + curPos.width,
        y1: curPos.y + NODE_H / 2,
        x2: nextPos.x,
        y2: nextPos.y + NODE_H / 2,
        style: "dashed",
      });
    }
  }

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = posMap.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + target.width / 2 : PAD,
      y: (target ? target.y + NODE_H : PAD + NODE_H) + POINTER_OFFSET_Y,
    };
  });

  let maxX = 0;
  let maxY = 0;
  for (const n of positioned) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const p of pointers) {
    maxY = Math.max(maxY, p.y + 20);
  }

  return { nodes: positioned, edges, pointers, width: maxX + PAD, height: maxY + PAD };
}
