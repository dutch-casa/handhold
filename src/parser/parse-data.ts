import type {
  DataState,
  ArrayData,
  LinkedListData,
  BinaryTreeData,
  GraphData,
  GraphLayoutKind,
  DataNodeDef,
  DataEdgeDef,
  DataPointerDef,
  GraphEdgeDef,
} from "@/types/lesson";
import { splitContentAndRegions } from "./parse-regions";

// Parse the data structure mini-language.
// Pure function: string + type tag → DataState.

export function parseData(
  text: string,
  type: string,
  name: string = "data-0",
  layout: GraphLayoutKind = "ring",
): DataState {
  const { content, regions } = splitContentAndRegions(text);

  switch (type) {
    case "array":
      return { kind: "data", name, data: parseArray(content), regions };
    case "linked-list":
      return { kind: "data", name, data: parseLinkedList(content), regions };
    case "binary-tree":
      return { kind: "data", name, data: parseBinaryTree(content), regions };
    case "graph":
      return { kind: "data", name, data: parseGraph(content, layout), regions };
    default:
      return { kind: "data", name, data: parseLinkedList(content), regions };
  }
}

// --- Array ---

function parseArray(text: string): ArrayData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const values: string[] = [];
  const pointers: DataPointerDef[] = [];

  for (const line of lines) {
    const arrayMatch = line.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      const inner = arrayMatch[1];
      if (inner) {
        values.push(...inner.split(",").map((v) => v.trim()));
      }
      continue;
    }

    for (const m of line.matchAll(/\^(\w+)=(\d+)/g)) {
      const name = m[1];
      const idx = m[2];
      if (name && idx) {
        pointers.push({ name, targetId: idx });
      }
    }
  }

  return { type: "array", values, pointers };
}

// --- Linked List ---

function parseLinkedList(text: string): LinkedListData {
  const nodes: DataNodeDef[] = [];
  const edges: DataEdgeDef[] = [];
  const pointers: DataPointerDef[] = [];
  let hasNull = false;
  const floatingGroups: DataNodeDef[][] = [];

  const groups = text.split(/\n\s*\n/).filter((g) => g.trim().length > 0);

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi];
    if (!group) continue;
    const groupLines = group.split("\n").filter((l) => l.trim().length > 0);
    const groupNodes: DataNodeDef[] = [];

    for (const line of groupLines) {
      for (const m of line.matchAll(/\((\w+)\s*(\S*)\)/g)) {
        const id = m[1];
        if (!id) continue;
        const value = m[2] || id;
        if (
          !nodes.some((n) => n.id === id) &&
          !groupNodes.some((n) => n.id === id)
        ) {
          groupNodes.push({ id, value });
        }
      }

      if (/-> *null/i.test(line)) {
        hasNull = true;
      }

      const allNodesHere = [...nodes, ...groupNodes];
      for (const pm of line.matchAll(/\^(\w+)/g)) {
        const name = pm[1];
        if (!name) continue;
        const col = pm.index ?? 0;
        const closest = findClosestNodeByColumn(col, allNodesHere);
        if (closest) {
          pointers.push({ name, targetId: closest });
        }
      }

      const chainIds: string[] = [];
      for (const cm of line.matchAll(/\((\w+)\s*\S*\)/g)) {
        const id = cm[1];
        if (id) chainIds.push(id);
      }
      for (let i = 0; i < chainIds.length - 1; i++) {
        const fromId = chainIds[i];
        const toId = chainIds[i + 1];
        if (fromId && toId) {
          edges.push({ fromId, toId });
        }
      }
    }

    if (gi === 0) {
      nodes.push(...groupNodes);
    } else {
      floatingGroups.push(groupNodes);
      nodes.push(...groupNodes);
    }
  }

  return {
    type: "linked-list",
    nodes,
    edges,
    pointers,
    hasNull,
    floatingGroups,
  };
}

function findClosestNodeByColumn(
  pointerCol: number,
  allNodes: readonly DataNodeDef[],
): string | undefined {
  if (allNodes.length === 0) return undefined;
  const idx = Math.round(pointerCol / 15);
  const clamped = Math.min(idx, allNodes.length - 1);
  return allNodes[clamped]?.id;
}

// --- Binary Tree ---

function parseBinaryTree(text: string): BinaryTreeData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const nodes: DataNodeDef[] = [];
  const edges: DataEdgeDef[] = [];
  const pointers: DataPointerDef[] = [];

  const valueToId = new Map<string, string>();

  for (const line of lines) {
    const arrayMatch = line.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      const inner = arrayMatch[1];
      if (!inner) continue;
      const values = inner.split(",").map((v) => v.trim());
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (!val || val === "null") continue;
        const id = String(i);
        nodes.push({ id, value: val });
        valueToId.set(val, id);

        if (i > 0) {
          const parentIdx = Math.floor((i - 1) / 2);
          const parentVal = values[parentIdx];
          if (parentVal && parentVal !== "null") {
            edges.push({ fromId: String(parentIdx), toId: id });
          }
        }
      }
      continue;
    }

    const pointerMatch = line.match(/\^(\w+):\s*(\S+)/);
    if (pointerMatch) {
      const name = pointerMatch[1];
      const targetValue = pointerMatch[2];
      if (name && targetValue) {
        const targetId = valueToId.get(targetValue);
        if (targetId) {
          pointers.push({ name, targetId });
        }
      }
    }
  }

  return { type: "binary-tree", nodes, edges, pointers };
}

// --- Graph ---

function parseGraph(
  text: string,
  layout: GraphLayoutKind = "ring",
): GraphData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const nodeIds = new Set<string>();
  const edges: GraphEdgeDef[] = [];
  const pointers: DataPointerDef[] = [];
  let directed = true;

  for (const line of lines) {
    const pointerMatch = line.match(/\^(\w+):\s*(\S+)/);
    if (pointerMatch) {
      const name = pointerMatch[1];
      const targetId = pointerMatch[2];
      if (name && targetId) {
        nodeIds.add(targetId);
        pointers.push({ name, targetId });
      }
      continue;
    }

    const edgeMatch = line.match(/^(\w+)\s*(->|--)\s*(.+)$/);
    if (edgeMatch) {
      const fromId = edgeMatch[1]!;
      const arrow = edgeMatch[2]!;
      const targetsPart = edgeMatch[3]!;

      if (arrow === "--") directed = false;
      nodeIds.add(fromId);

      for (const target of targetsPart.split(",")) {
        const weightMatch = target.trim().match(/^(\w+)(?::\s*(\S+))?$/);
        if (!weightMatch) continue;
        const toId = weightMatch[1]!;
        const weight = weightMatch[2] ?? "";
        nodeIds.add(toId);
        edges.push({ fromId, toId, weight });
      }
      continue;
    }
  }

  const nodes: DataNodeDef[] = [...nodeIds].map((id) => ({ id, value: id }));
  return { type: "graph", nodes, edges, pointers, directed, layout };
}
