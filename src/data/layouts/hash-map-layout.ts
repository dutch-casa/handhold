import type { HashMapData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Vertical bucket column on left with horizontal chains extending right.

const BUCKET_W = 40;
const BUCKET_H = 44;
const NODE_W = 72;
const NODE_H = 44;
const H_GAP = 40;
const V_GAP = 8;
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
    let prevId = `bucket-${bucket.index}`;

    for (const node of bucket.chain) {
      nodes.push({
        id: node.id,
        value: node.value,
        x: chainX,
        y: bucketY,
        width: NODE_W,
        height: NODE_H,
      });

      // Edge from previous (bucket or chain node) to this node
      const prevNode = nodes.find((n) => n.id === prevId);
      if (prevNode) {
        edges.push({
          id: `${prevId}->${node.id}`,
          x1: prevNode.x + prevNode.width,
          y1: prevNode.y + prevNode.height / 2,
          x2: chainX,
          y2: bucketY + NODE_H / 2,
        });
      }

      prevId = node.id;
      chainX += NODE_W + H_GAP;
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
