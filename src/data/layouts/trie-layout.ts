import type { TrieData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Trie layout: reuses n-ary tree algorithm with trie-specific node sizing.
// Single-char trie nodes are small circles. Radix-tree nodes are wider rects.
// Terminal nodes get the "terminal" marker (double border).

const CHAR_NODE_R = 18;
const CHAR_NODE_D = CHAR_NODE_R * 2;
const RADIX_NODE_H = 36;
const CHAR_W = 10;
const RADIX_PAD = 16;
const V_GAP = 48;
const H_GAP = 20;
const PAD = 24;
const POINTER_OFFSET_Y = 36;

type TrieNodeInfo = {
  readonly id: string;
  readonly value: string;
  readonly terminal: boolean;
  readonly children: readonly string[];
  readonly width: number;
  readonly height: number;
  readonly isRadix: boolean;
};

function measureNode(value: string, isRadix: boolean): { width: number; height: number } {
  if (!isRadix || value.length <= 1) {
    return { width: CHAR_NODE_D, height: CHAR_NODE_D };
  }
  return { width: value.length * CHAR_W + RADIX_PAD * 2, height: RADIX_NODE_H };
}

export function layoutTrie(data: TrieData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const isRadix = data.variant === "radix-tree" || data.variant === "suffix-tree";
  const nodeInfos = new Map<string, TrieNodeInfo>();
  for (const n of data.nodes) {
    const { width, height } = measureNode(n.value, isRadix);
    nodeInfos.set(n.id, { ...n, width, height, isRadix });
  }

  const root = nodeInfos.get(data.rootId);
  if (!root) return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };

  // Subtree widths
  const subtreeWidth = new Map<string, number>();

  function computeWidth(id: string): number {
    const info = nodeInfos.get(id);
    if (!info || info.children.length === 0) {
      const w = info?.width ?? CHAR_NODE_D;
      subtreeWidth.set(id, w);
      return w;
    }
    let total = 0;
    for (const childId of info.children) {
      total += computeWidth(childId);
    }
    total += H_GAP * (info.children.length - 1);
    subtreeWidth.set(id, total);
    return total;
  }

  const totalWidth = computeWidth(data.rootId);

  const positioned: PositionedNode[] = [];
  const posMap = new Map<string, PositionedNode>();

  function assignPositions(id: string, bandLeft: number, bandWidth: number, depth: number): void {
    const info = nodeInfos.get(id);
    if (!info) return;

    const x = bandLeft + bandWidth / 2 - info.width / 2;
    const y = PAD + depth * V_GAP;

    const pos: PositionedNode = {
      id: info.id,
      value: info.value,
      x,
      y,
      width: info.width,
      height: info.height,
      shape: info.isRadix && info.value.length > 1 ? "rect" : "circle",
      marker: info.terminal ? "terminal" : undefined,
    };
    positioned.push(pos);
    posMap.set(info.id, pos);

    if (info.children.length === 0) return;

    let childX = bandLeft + (bandWidth - (subtreeWidth.get(id) ?? info.width)) / 2;
    for (const childId of info.children) {
      const childWidth = subtreeWidth.get(childId) ?? CHAR_NODE_D;
      assignPositions(childId, childX, childWidth, depth + 1);
      childX += childWidth + H_GAP;
    }
  }

  assignPositions(data.rootId, PAD, totalWidth, 0);

  // Edges: parent bottom-center → child top-center
  const edges: PositionedEdge[] = [];
  for (const n of data.nodes) {
    const parentPos = posMap.get(n.id);
    if (!parentPos) continue;
    for (const childId of n.children) {
      const childPos = posMap.get(childId);
      if (!childPos) continue;
      edges.push({
        id: `${n.id}->${childId}`,
        x1: parentPos.x + parentPos.width / 2,
        y1: parentPos.y + parentPos.height,
        x2: childPos.x + childPos.width / 2,
        y2: childPos.y,
      });
    }
  }

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = posMap.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + target.width / 2 : PAD,
      y: (target ? target.y + target.height : PAD + CHAR_NODE_D) + POINTER_OFFSET_Y,
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
