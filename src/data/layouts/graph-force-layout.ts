import type { GraphData } from "@/types/lesson";
import type { Layout, PositionedNode, PositionedEdge, PositionedPointer } from "../layout-types";

// Fruchterman-Reingold force-directed layout.
// Pure TypeScript — sufficient for small lesson graphs.

const NODE_R = 22;
const NODE_D = NODE_R * 2;
const PAD = 32;
const POINTER_OFFSET_Y = 36;

const ITERATIONS = 80;
const COOLING = 0.95;

// Float64Array elements within bounds are always defined.
// noUncheckedIndexedAccess doesn't know this, so we assert once here.
function at(arr: Float64Array, i: number): number {
  return arr[i] as number;
}

export function layoutForce(data: GraphData): Layout {
  if (data.nodes.length === 0) {
    return { nodes: [], edges: [], pointers: [], width: 0, height: 0 };
  }
  if (data.nodes.length === 1) {
    const def = data.nodes[0]!;
    return {
      nodes: [{ id: def.id, value: def.value, x: PAD, y: PAD, width: NODE_D, height: NODE_D, shape: "circle" }],
      edges: [],
      pointers: data.pointers.map((p) => ({ name: p.name, x: PAD + NODE_R, y: PAD + NODE_D + POINTER_OFFSET_Y })),
      width: NODE_D + PAD * 2,
      height: NODE_D + PAD * 2 + (data.pointers.length > 0 ? POINTER_OFFSET_Y + 20 : 0),
    };
  }

  const n = data.nodes.length;
  const area = (n * 80) ** 2;
  const k = Math.sqrt(area / n);

  // Initialize positions on a circle to avoid degenerate start
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  const initR = k * 1.5;
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n;
    xs[i] = 200 + initR * Math.cos(angle);
    ys[i] = 200 + initR * Math.sin(angle);
  }

  // Index lookup
  const idToIdx = new Map<string, number>();
  for (let i = 0; i < n; i++) idToIdx.set(data.nodes[i]!.id, i);

  // Edge pairs as index tuples
  const edgePairs: [number, number][] = [];
  for (const e of data.edges) {
    const fi = idToIdx.get(e.fromId);
    const ti = idToIdx.get(e.toId);
    if (fi !== undefined && ti !== undefined) edgePairs.push([fi, ti]);
  }

  // Simulate
  let temp = k * 2;
  const dispX = new Float64Array(n);
  const dispY = new Float64Array(n);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    dispX.fill(0);
    dispY.fill(0);

    // Repulsive forces: all node pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = at(xs, i) - at(xs, j);
        const dy = at(ys, i) - at(ys, j);
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        dispX[i] = at(dispX, i) + fx;
        dispY[i] = at(dispY, i) + fy;
        dispX[j] = at(dispX, j) - fx;
        dispY[j] = at(dispY, j) - fy;
      }
    }

    // Attractive forces: edges pull connected nodes together
    for (const [fi, ti] of edgePairs) {
      const dx = at(xs, fi) - at(xs, ti);
      const dy = at(ys, fi) - at(ys, ti);
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      dispX[fi] = at(dispX, fi) - fx;
      dispY[fi] = at(dispY, fi) - fy;
      dispX[ti] = at(dispX, ti) + fx;
      dispY[ti] = at(dispY, ti) + fy;
    }

    // Apply displacement, clamped by temperature
    for (let i = 0; i < n; i++) {
      const mag = Math.sqrt(at(dispX, i) ** 2 + at(dispY, i) ** 2) || 0.01;
      const clamp = Math.min(mag, temp) / mag;
      xs[i] = at(xs, i) + at(dispX, i) * clamp;
      ys[i] = at(ys, i) + at(dispY, i) * clamp;
    }

    temp *= COOLING;
  }

  // Normalize: shift so minimum position sits at PAD
  let minX = Infinity;
  let minY = Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, at(xs, i));
    minY = Math.min(minY, at(ys, i));
  }
  for (let i = 0; i < n; i++) {
    xs[i] = at(xs, i) - minX + PAD;
    ys[i] = at(ys, i) - minY + PAD;
  }

  const positioned = new Map<string, PositionedNode>();
  const nodes: PositionedNode[] = [];

  for (let i = 0; i < n; i++) {
    const def = data.nodes[i]!;
    const node: PositionedNode = {
      id: def.id,
      value: def.value,
      x: at(xs, i) - NODE_R,
      y: at(ys, i) - NODE_R,
      width: NODE_D,
      height: NODE_D,
      shape: "circle",
    };
    nodes.push(node);
    positioned.set(def.id, node);
  }

  const edges: PositionedEdge[] = data.edges.map((e) => {
    const from = positioned.get(e.fromId);
    const to = positioned.get(e.toId);
    if (!from || !to) return { id: `${e.fromId}->${e.toId}`, x1: 0, y1: 0, x2: 0, y2: 0 };

    const fromCx = from.x + NODE_R;
    const fromCy = from.y + NODE_R;
    const toCx = to.x + NODE_R;
    const toCy = to.y + NODE_R;
    const dx = toCx - fromCx;
    const dy = toCy - fromCy;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const ux = dx / dist;
    const uy = dy / dist;

    return {
      id: `${e.fromId}->${e.toId}`,
      x1: fromCx + ux * NODE_R,
      y1: fromCy + uy * NODE_R,
      x2: toCx - ux * NODE_R,
      y2: toCy - uy * NODE_R,
      ...(e.weight ? { label: e.weight } : {}),
    };
  });

  const pointers: PositionedPointer[] = data.pointers.map((p) => {
    const target = positioned.get(p.targetId);
    return {
      name: p.name,
      x: target ? target.x + NODE_R : PAD,
      y: (target ? target.y + NODE_D : PAD + NODE_D) + POINTER_OFFSET_Y,
    };
  });

  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  for (const p of pointers) maxY = Math.max(maxY, p.y + 20);

  return { nodes, edges, pointers, width: maxX + PAD, height: maxY + PAD };
}
