import type { HashMapData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";
import { measureCellWidth } from "./measure";

// Vertical bucket column on left with horizontal chains extending right.

const BUCKET_W = 40;
const BUCKET_H = 44;
const NODE_H = 44;
const H_GAP = 32;
const V_GAP = 16;
const PAD = 24;

export function layoutHashMap(data: HashMapData): Layout {
  if (data.buckets.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }

  const nodes: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  for (let bi = 0; bi < data.buckets.length; bi++) {
    const bucket = data.buckets[bi];
    if (!bucket) continue;
    const bucketY = PAD + bi * (BUCKET_H + V_GAP);

    // Bucket header cell
    nodes.push({
      id: `bucket-${bucket.index}`,
      value: String(bucket.index),
      x: PAD,
      y: bucketY,
      width: BUCKET_W,
      height: BUCKET_H,
      marker: "bucket-header",
    });

    // Chain nodes extending rightward
    let chainX = PAD + BUCKET_W + H_GAP;
    const bucketNode = nodes[nodes.length - 1]!;
    let prevNode: PositionedNode = bucketNode;

    for (const node of bucket.chain) {
      const nodeW = measureCellWidth(node.value, 72);
      const positioned: PositionedNode = {
        id: node.id,
        value: node.value,
        x: chainX,
        y: bucketY,
        width: nodeW,
        height: NODE_H,
      };
      nodes.push(positioned);

      edges.push({
        id: `${prevNode.id}->${node.id}`,
        x1: prevNode.x + prevNode.width,
        y1: prevNode.y + prevNode.height / 2,
        x2: chainX,
        y2: bucketY + NODE_H / 2,
      });

      prevNode = positioned;
      chainX += nodeW + H_GAP;
    }
  }

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }

  const pointers: PositionedPointer[] = [];
  return { nodes, edges, pointers, width: maxX + PAD, height: maxY + PAD };
}
