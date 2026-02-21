import type { TreeData, TreeNodeDef } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

const LEVEL_GAP = 8;
const H_GAP = 24;
const PAD = 24;
const POINTER_OFFSET_Y = 36;

// Bottom-up subtree width algorithm for n-ary trees.
// 1. Post-order: compute each node's subtree width
// 2. Pre-order: assign x positions by distributing within allocated bands

export function layoutNaryTree(data: TreeData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const maxValueW = data.nodes.length > 0
    ? Math.max(...data.nodes.map((n) => measureCellWidth(n.value, 44)))
    : 44;
  const NODE_R = Math.max(22, Math.ceil(maxValueW / 2));
  const NODE_D = NODE_R * 2;

  const nodeMap = new Map<string, TreeNodeDef>();
  for (const n of data.nodes) nodeMap.set(n.id, n);

  const root = nodeMap.get(data.rootId);
  if (!root) return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };

  // Phase 1: compute subtree widths (post-order)
  const subtreeWidth = new Map<string, number>();

  function computeWidth(id: string): number {
    const node = nodeMap.get(id);
    if (!node || node.children.length === 0) {
      subtreeWidth.set(id, NODE_D);
      return NODE_D;
    }
    let total = 0;
    for (const childId of node.children) {
      total += computeWidth(childId);
    }
    total += H_GAP * (node.children.length - 1);
    subtreeWidth.set(id, total);
    return total;
  }

  const totalWidth = computeWidth(data.rootId);

  // Phase 2: assign positions (pre-order)
  const positioned: PositionedNode[] = [];
  const posMap = new Map<string, PositionedNode>();

  function assignPositions(id: string, bandLeft: number, bandWidth: number, depth: number): void {
    const node = nodeMap.get(id);
    if (!node) return;

    const x = bandLeft + bandWidth / 2 - NODE_R;
    const y = PAD + depth * (NODE_D + LEVEL_GAP);
    const marker = resolveMarker(data.variant, node.annotation);

    const pos: PositionedNode = {
      id: node.id,
      value: node.value,
      x,
      y,
      width: NODE_D,
      height: NODE_D,
      shape: "circle",
      ...(marker ? { marker } : {}),
      ...(node.annotation.length > 0 ? { secondaryValue: node.annotation } : {}),
    };
    positioned.push(pos);
    posMap.set(node.id, pos);

    if (node.children.length === 0) return;

    // Distribute children within the band proportional to their subtree widths
    let childX = bandLeft + (bandWidth - (subtreeWidth.get(id) ?? NODE_D)) / 2;
    for (const childId of node.children) {
      const childWidth = subtreeWidth.get(childId) ?? NODE_D;
      assignPositions(childId, childX, childWidth, depth + 1);
      childX += childWidth + H_GAP;
    }
  }

  assignPositions(data.rootId, PAD, totalWidth, 0);

  // Edges: parent center-bottom → child center-top
  const edges: PositionedEdge[] = [];
  for (const node of data.nodes) {
    const parentPos = posMap.get(node.id);
    if (!parentPos) continue;
    for (const childId of node.children) {
      const childPos = posMap.get(childId);
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

  // Pointers
  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = posMap.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + NODE_R : PAD,
      y: (target ? target.y + NODE_D : PAD + NODE_D) + POINTER_OFFSET_Y,
    };
  });

  // Bounds
  let maxX = 0;
  let maxY = 0;
  for (const n of positioned) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const p of pointers) {
    maxY = Math.max(maxY, p.y + 20);
  }

  return {
    nodes: positioned,
    edges,
    pointers,
    width: maxX + PAD,
    height: maxY + PAD,
  };
}

function resolveMarker(
  variant: TreeData["variant"],
  annotation: string,
): PositionedNode["marker"] {
  if (variant === "red-black" && annotation === "R") return "red";
  if (variant === "red-black" && annotation === "B") return "black";
  if (annotation === "marked") return "marked";
  return undefined;
}
