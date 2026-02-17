import type { BinaryTreeData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

const NODE_R = 22;
const NODE_D = NODE_R * 2;
const V_GAP = 56;
const PAD = 24;
const POINTER_OFFSET_Y = 36;
const MIN_H_GAP = 16;

export function layoutBinaryTree(data: BinaryTreeData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  // Determine tree depth from heap indices
  const maxIdx = Math.max(...data.nodes.map((n) => Number(n.id)));
  const depth = Math.floor(Math.log2(maxIdx + 1)) + 1;

  // Width sized to accommodate the bottom level
  const bottomSlots = 2 ** (depth - 1);
  const totalW = bottomSlots * (NODE_D + MIN_H_GAP) - MIN_H_GAP + PAD * 2;

  const nodePositions = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];

  for (const nodeDef of data.nodes) {
    const i = Number(nodeDef.id);
    const level = Math.floor(Math.log2(i + 1));
    const posInLevel = i - (2 ** level - 1);
    const slotsAtLevel = 2 ** level;

    const slotWidth = (totalW - PAD * 2) / slotsAtLevel;
    const x = PAD + posInLevel * slotWidth + slotWidth / 2 - NODE_R;
    const y = PAD + level * V_GAP;

    const positioned: PositionedNode = {
      id: nodeDef.id,
      value: nodeDef.value,
      x,
      y,
      width: NODE_D,
      height: NODE_D,
      shape: "circle",
    };
    nodes.push(positioned);
    nodePositions.set(nodeDef.id, positioned);
  }

  // Edges: parent bottom-center → child top-center
  const edges: PositionedEdge[] = data.edges
    .map((e) => {
      const from = nodePositions.get(e.fromId);
      const to = nodePositions.get(e.toId);
      if (!from || !to) return null;
      return {
        id: `${e.fromId}->${e.toId}`,
        x1: from.x + NODE_R,
        y1: from.y + NODE_D,
        x2: to.x + NODE_R,
        y2: to.y,
      };
    })
    .filter((e): e is PositionedEdge => e !== null);

  // Pointers sit below their target node
  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = nodePositions.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + NODE_R : PAD,
      y: (target ? target.y + NODE_D : PAD + NODE_D) + POINTER_OFFSET_Y,
    };
  });

  const maxY = depth * V_GAP + PAD;
  const pointerMaxY = pointers.length > 0 ? Math.max(...pointers.map((p) => p.y + 20)) : maxY;

  return {
    nodes,
    edges,
    pointers,
    width: totalW,
    height: Math.max(maxY, pointerMaxY) + PAD,
  };
}
