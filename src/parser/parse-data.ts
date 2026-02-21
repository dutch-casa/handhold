import type {
  DataState,
  ArrayData,
  LinkedListData,
  TreeData,
  TreeVariant,
  TreeNodeDef,
  GraphData,
  GraphLayoutKind,
  DataNodeDef,
  DataEdgeDef,
  DataPointerDef,
  GraphEdgeDef,
  QueueData,
  DequeData,
  RingBufferData,
  DoublyLinkedListData,
  SkipListData,
  SkipListLevel,
  BTreeData,
  BTreeVariant,
  BTreeNodeDef,
  TrieData,
  TrieVariant,
  TrieNodeDef,
  BitArrayData,
  BitArrayVariant,
  HashHighlight,
  MatrixData,
  UnionFindData,
  LsmTreeData,
  FibonacciHeapData,
  HashMapData,
  StackData,
} from "@/types/lesson";
import { splitContentAndRegions } from "./parse-regions";

// Parse the data structure mini-language.
// Pure function: string + type tag + params → DataState.

const TREE_VARIANTS = new Set<TreeVariant>([
  "generic", "bst", "avl", "red-black", "heap-min", "heap-max",
  "splay", "treap", "aa", "segment", "interval", "fenwick",
  "merkle", "kd", "rope",
]);

const BTREE_VARIANTS = new Set<BTreeVariant>([
  "b-tree", "b-plus-tree", "2-3-tree", "2-3-4-tree",
]);

const TRIE_VARIANTS = new Set<TrieVariant>([
  "trie", "radix-tree", "suffix-tree",
]);

const BIT_ARRAY_VARIANTS = new Set<BitArrayVariant>([
  "bloom-filter", "cuckoo-filter", "count-min-sketch", "hyperloglog",
]);

export function parseData(
  text: string,
  type: string,
  name: string = "data-0",
  layout: GraphLayoutKind = "ring",
  params: ReadonlyMap<string, string> = new Map(),
): DataState {
  const { content, regions } = splitContentAndRegions(text);

  switch (type) {
    case "array":
      return { kind: "data", name, data: parseArray(content), regions };
    case "linked-list":
      return { kind: "data", name, data: parseLinkedList(content), regions };
    case "tree":
    case "binary-tree": {
      const variantParam = params.get("variant") ?? "generic";
      const variant: TreeVariant = TREE_VARIANTS.has(variantParam as TreeVariant)
        ? (variantParam as TreeVariant)
        : "generic";
      return { kind: "data", name, data: parseTree(content, variant), regions };
    }
    case "graph":
      return { kind: "data", name, data: parseGraph(content, layout), regions };
    case "stack":
      return { kind: "data", name, data: parseStack(content), regions };
    case "queue":
      return { kind: "data", name, data: parseQueue(content), regions };
    case "deque":
      return { kind: "data", name, data: parseDeque(content), regions };
    case "ring-buffer": {
      const capacity = Number(params.get("capacity") ?? "0");
      return { kind: "data", name, data: parseRingBuffer(content, capacity), regions };
    }
    case "doubly-linked-list":
      return { kind: "data", name, data: parseDoublyLinkedList(content), regions };
    case "skip-list":
      return { kind: "data", name, data: parseSkipList(content), regions };
    case "hash-map":
      return { kind: "data", name, data: parseHashMap(content), regions };
    case "hash-set":
      return { kind: "data", name, data: parseHashMap(content), regions };
    case "b-tree":
    case "b-plus-tree":
    case "2-3-tree":
    case "2-3-4-tree": {
      const variantParam = params.get("variant") ?? type;
      const variant: BTreeVariant = BTREE_VARIANTS.has(variantParam as BTreeVariant)
        ? (variantParam as BTreeVariant)
        : "b-tree";
      const order = Number(params.get("order") ?? "3");
      return { kind: "data", name, data: parseBTree(content, variant, order), regions };
    }
    case "trie":
    case "radix-tree":
    case "suffix-tree": {
      const variantParam = params.get("variant") ?? type;
      const variant: TrieVariant = TRIE_VARIANTS.has(variantParam as TrieVariant)
        ? (variantParam as TrieVariant)
        : "trie";
      return { kind: "data", name, data: parseTrie(content, variant), regions };
    }
    case "bit-array":
    case "bloom-filter":
    case "cuckoo-filter":
    case "count-min-sketch":
    case "hyperloglog": {
      const variantParam = params.get("variant") ?? type;
      const variant: BitArrayVariant = BIT_ARRAY_VARIANTS.has(variantParam as BitArrayVariant)
        ? (variantParam as BitArrayVariant)
        : "bloom-filter";
      const rows = Number(params.get("rows") ?? "1");
      return { kind: "data", name, data: parseBitArray(content, variant, rows), regions };
    }
    case "matrix":
      return { kind: "data", name, data: parseMatrix(content), regions };
    case "union-find":
      return { kind: "data", name, data: parseUnionFind(content), regions };
    case "lsm-tree":
      return { kind: "data", name, data: parseLsmTree(content), regions };
    case "fibonacci-heap":
      return { kind: "data", name, data: parseFibonacciHeap(content), regions };
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

// --- Tree (n-ary, replaces binary-tree) ---
// Supports two input formats:
// 1. Indentation format: (id) or (id:annotation) with 2-space indent per level
// 2. Array format (backward compat): [v1, v2, ...] uses heap-index math

function parseTree(text: string, variant: TreeVariant): TreeData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  // Detect format: array lines start with [
  const hasArrayLine = lines.some((l) => l.trim().startsWith("["));
  if (hasArrayLine) return parseTreeFromArray(lines, variant);
  return parseTreeFromIndentation(lines, variant);
}

function parseTreeFromArray(lines: readonly string[], variant: TreeVariant): TreeData {
  const nodes: TreeNodeDef[] = [];
  const pointers: DataPointerDef[] = [];
  const valueToId = new Map<string, string>();

  for (const line of lines) {
    const arrayMatch = line.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      const inner = arrayMatch[1];
      if (!inner) continue;
      const values = inner.split(",").map((v) => v.trim());
      // First pass: create all nodes
      for (let i = 0; i < values.length; i++) {
        const val = values[i];
        if (!val || val === "null") continue;
        const id = String(i);
        const [value, annotation] = splitAnnotation(val);
        nodes.push({ id, value, children: [], annotation });
        valueToId.set(val, id);
      }
      // Second pass: wire up children using heap-index math
      const withChildren: TreeNodeDef[] = nodes.map((node) => {
        const i = Number(node.id);
        const leftIdx = 2 * i + 1;
        const rightIdx = 2 * i + 2;
        const children: string[] = [];
        if (leftIdx < values.length && values[leftIdx] && values[leftIdx] !== "null") {
          children.push(String(leftIdx));
        }
        if (rightIdx < values.length && values[rightIdx] && values[rightIdx] !== "null") {
          children.push(String(rightIdx));
        }
        return { ...node, children };
      });
      nodes.length = 0;
      nodes.push(...withChildren);
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

  const rootId = nodes.length > 0 ? nodes[0]!.id : "";
  return { type: "tree", variant, nodes, rootId, pointers };
}

function parseTreeFromIndentation(lines: readonly string[], variant: TreeVariant): TreeData {
  const nodes: TreeNodeDef[] = [];
  const pointers: DataPointerDef[] = [];
  // Stack of (id, indent) for tracking parent-child via indentation depth
  const stack: { id: string; indent: number }[] = [];

  // Map from id → mutable children list (built up during parsing)
  const childrenMap = new Map<string, string[]>();

  for (const line of lines) {
    // Pointer lines
    const pointerMatch = line.match(/^\^(\w+):\s*(\S+)/);
    if (pointerMatch) {
      const name = pointerMatch[1];
      const targetId = pointerMatch[2];
      if (name && targetId) pointers.push({ name, targetId });
      continue;
    }

    // Node lines: (id) or (id:annotation)
    const nodeMatch = line.match(/^(\s*)\(([^)]+)\)/);
    if (!nodeMatch) continue;

    const indent = nodeMatch[1]?.length ?? 0;
    const raw = nodeMatch[2] ?? "";
    const [value, annotation] = splitAnnotation(raw);

    // Use value as id (lowercase, no spaces)
    const id = value.replace(/\s+/g, "-");

    childrenMap.set(id, []);
    nodes.push({ id, value, children: [], annotation });

    // Pop stack to find parent at lower indent
    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }

    // Wire to parent
    if (stack.length > 0) {
      const parentId = stack[stack.length - 1]!.id;
      const parentChildren = childrenMap.get(parentId);
      if (parentChildren) parentChildren.push(id);
    }

    stack.push({ id, indent });
  }

  // Rebuild nodes with finalized children arrays
  const finalNodes: TreeNodeDef[] = nodes.map((n) => ({
    ...n,
    children: childrenMap.get(n.id) ?? [],
  }));

  const rootId = finalNodes.length > 0 ? finalNodes[0]!.id : "";
  return { type: "tree", variant, nodes: finalNodes, rootId, pointers };
}

// Split "value:annotation" → ["value", "annotation"]
// Handles: "7:B" → ["7", "B"], "nav" → ["nav", ""]
function splitAnnotation(raw: string): [string, string] {
  const colonIdx = raw.indexOf(":");
  if (colonIdx === -1) return [raw, ""];
  return [raw.slice(0, colonIdx), raw.slice(colonIdx + 1)];
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

// --- Stack ---
// DSL: [main, foo, bar, baz] followed by ^top=N

function parseStack(text: string): StackData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const values: string[] = [];
  let topIndex = -1;

  for (const line of lines) {
    const arrayMatch = line.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      const inner = arrayMatch[1];
      if (inner) values.push(...inner.split(",").map((v) => v.trim()));
      continue;
    }
    const topMatch = line.match(/\^top=(\d+)/);
    if (topMatch && topMatch[1]) {
      topIndex = Number(topMatch[1]);
    }
  }

  if (topIndex < 0) topIndex = values.length - 1;
  return { type: "stack", values, topIndex };
}

// --- Queue ---

function parseQueue(text: string): QueueData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const values: string[] = [];
  const pointers: DataPointerDef[] = [];
  let front = 0;
  let rear = 0;

  for (const line of lines) {
    const arrayMatch = line.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      const inner = arrayMatch[1];
      if (inner) values.push(...inner.split(",").map((v) => v.trim()));
      continue;
    }
    const frontMatch = line.match(/\^front=(\d+)/);
    if (frontMatch && frontMatch[1]) front = Number(frontMatch[1]);
    const rearMatch = line.match(/\^rear=(\d+)/);
    if (rearMatch && rearMatch[1]) rear = Number(rearMatch[1]);

    for (const m of line.matchAll(/\^(\w+)=(\d+)/g)) {
      const name = m[1];
      const idx = m[2];
      if (name && idx && name !== "front" && name !== "rear") {
        pointers.push({ name, targetId: idx });
      }
    }
  }

  if (values.length > 0 && rear === 0) rear = values.length - 1;
  return { type: "queue", values, front, rear, pointers };
}

// --- Deque ---

function parseDeque(text: string): DequeData {
  const q = parseQueue(text);
  return { type: "deque", values: q.values, front: q.front, rear: q.rear, pointers: q.pointers };
}

// --- Ring Buffer ---
// DSL: [10, 20, 30, _, _, _, _, 80] followed by ^head=N ^tail=N

function parseRingBuffer(text: string, capacity: number): RingBufferData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const values: string[] = [];
  let head = 0;
  let tail = 0;

  for (const line of lines) {
    const arrayMatch = line.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      const inner = arrayMatch[1];
      if (inner) values.push(...inner.split(",").map((v) => v.trim()));
      continue;
    }
    const headMatch = line.match(/\^head=(\d+)/);
    if (headMatch && headMatch[1]) head = Number(headMatch[1]);
    const tailMatch = line.match(/\^tail=(\d+)/);
    if (tailMatch && tailMatch[1]) tail = Number(tailMatch[1]);
  }

  const finalCapacity = capacity > 0 ? capacity : values.length;
  return { type: "ring-buffer", values, head, tail, capacity: finalCapacity };
}

// --- Doubly Linked List ---
// DSL: (a 10) <-> (b 20) <-> (c 30) -> null

function parseDoublyLinkedList(text: string): DoublyLinkedListData {
  const nodes: DataNodeDef[] = [];
  const edges: DataEdgeDef[] = [];
  const pointers: DataPointerDef[] = [];
  let hasNull = false;

  const lines = text.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    // Pointer lines
    const pointerMatch = line.match(/\^(\w+):\s*(\S+)/);
    if (pointerMatch) {
      const name = pointerMatch[1];
      const targetId = pointerMatch[2];
      if (name && targetId) pointers.push({ name, targetId });
      continue;
    }

    // Parse nodes from the chain
    for (const m of line.matchAll(/\((\w+)\s*(\S*)\)/g)) {
      const id = m[1];
      if (!id) continue;
      const value = m[2] || id;
      if (!nodes.some((n) => n.id === id)) {
        nodes.push({ id, value });
      }
    }

    if (/-> *null/i.test(line)) hasNull = true;

    // Extract chain IDs for edges (bidirectional via <->)
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

  return { type: "doubly-linked-list", nodes, edges, pointers, hasNull };
}

// --- Skip List ---
// DSL: L3: (H) -> (6) -> (nil)  (one line per level, highest first)

function parseSkipList(text: string): SkipListData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const nodeMap = new Map<string, DataNodeDef>();
  const levels: SkipListLevel[] = [];
  const pointers: DataPointerDef[] = [];

  for (const line of lines) {
    const levelMatch = line.match(/^L(\d+):\s*(.+)$/);
    if (!levelMatch) {
      const pointerMatch = line.match(/\^(\w+):\s*(\S+)/);
      if (pointerMatch) {
        const name = pointerMatch[1];
        const targetId = pointerMatch[2];
        if (name && targetId) pointers.push({ name, targetId });
      }
      continue;
    }
    const level = Number(levelMatch[1] ?? "0");
    const content = levelMatch[2] ?? "";

    const nodeIds: string[] = [];
    for (const m of content.matchAll(/\((\w+)\)/g)) {
      const id = m[1];
      if (!id) continue;
      nodeIds.push(id);
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, value: id });
      }
    }

    levels.push({ level, nodeIds });
  }

  // Sort levels descending by level number
  levels.sort((a, b) => b.level - a.level);

  return {
    type: "skip-list",
    nodes: [...nodeMap.values()],
    levels,
    pointers,
  };
}

// --- Hash Map ---
// DSL: 0: (alice 555-1234) -> (bob 555-5678)

function parseHashMap(text: string): HashMapData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const buckets: { index: number; chain: DataNodeDef[] }[] = [];

  for (const line of lines) {
    const bucketMatch = line.match(/^(\d+):\s*(.*)$/);
    if (!bucketMatch) continue;
    const index = Number(bucketMatch[1] ?? "0");
    const content = bucketMatch[2] ?? "";
    const chain: DataNodeDef[] = [];

    for (const m of content.matchAll(/\((\w+)\s*([^)]*)\)/g)) {
      const id = m[1];
      if (!id) continue;
      const value = m[2]?.trim() || id;
      chain.push({ id, value });
    }

    buckets.push({ index, chain });
  }

  return { type: "hash-map", buckets };
}

// --- B-Tree ---
// DSL: (root: 10, 20) with indentation for children

function parseBTree(text: string, variant: BTreeVariant, order: number): BTreeData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const nodes: BTreeNodeDef[] = [];
  const pointers: DataPointerDef[] = [];
  const childrenMap = new Map<string, string[]>();
  const stack: { id: string; indent: number }[] = [];
  const leafLinks = variant === "b-plus-tree";

  for (const line of lines) {
    const pointerMatch = line.match(/^\^(\w+):\s*(\S+)/);
    if (pointerMatch) {
      const name = pointerMatch[1];
      const targetId = pointerMatch[2];
      if (name && targetId) pointers.push({ name, targetId });
      continue;
    }

    // Node line: (id: k1, k2, k3)
    const nodeMatch = line.match(/^(\s*)\((\w+):\s*([^)]+)\)/);
    if (!nodeMatch) continue;

    const indent = nodeMatch[1]?.length ?? 0;
    const id = nodeMatch[2] ?? "";
    const keysStr = nodeMatch[3] ?? "";
    const keys = keysStr.split(",").map((k) => k.trim()).filter((k) => k.length > 0);

    childrenMap.set(id, []);
    nodes.push({ id, keys, children: [] });

    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }
    if (stack.length > 0) {
      const parentId = stack[stack.length - 1]!.id;
      childrenMap.get(parentId)?.push(id);
    }
    stack.push({ id, indent });
  }

  const finalNodes: BTreeNodeDef[] = nodes.map((n) => ({
    ...n,
    children: childrenMap.get(n.id) ?? [],
  }));

  const rootId = finalNodes.length > 0 ? finalNodes[0]!.id : "";
  return { type: "b-tree", variant, nodes: finalNodes, rootId, order, pointers, leafLinks };
}

// --- Trie ---
// DSL: () with indentation, * marks terminal

function parseTrie(text: string, variant: TrieVariant): TrieData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const nodes: TrieNodeDef[] = [];
  const pointers: DataPointerDef[] = [];
  const childrenMap = new Map<string, string[]>();
  const stack: { id: string; indent: number }[] = [];
  let nodeCounter = 0;

  for (const line of lines) {
    const pointerMatch = line.match(/^\^(\w+):\s*(\S+)/);
    if (pointerMatch) {
      const name = pointerMatch[1];
      const targetId = pointerMatch[2];
      if (name && targetId) pointers.push({ name, targetId });
      continue;
    }

    // Node line: (value) or (value*)
    const nodeMatch = line.match(/^(\s*)\(([^)]*)\)/);
    if (!nodeMatch) continue;

    const indent = nodeMatch[1]?.length ?? 0;
    let raw = nodeMatch[2] ?? "";
    const terminal = raw.endsWith("*");
    if (terminal) raw = raw.slice(0, -1);

    const id = `trie-${nodeCounter++}`;
    childrenMap.set(id, []);
    nodes.push({ id, value: raw, terminal, children: [] });

    while (stack.length > 0 && stack[stack.length - 1]!.indent >= indent) {
      stack.pop();
    }
    if (stack.length > 0) {
      const parentId = stack[stack.length - 1]!.id;
      childrenMap.get(parentId)?.push(id);
    }
    stack.push({ id, indent });
  }

  const finalNodes: TrieNodeDef[] = nodes.map((n) => ({
    ...n,
    children: childrenMap.get(n.id) ?? [],
  }));

  const rootId = finalNodes.length > 0 ? finalNodes[0]!.id : "";
  return { type: "trie", variant, nodes: finalNodes, rootId, pointers };
}

// --- Bit Array / Bloom Filter / Count-Min Sketch / HyperLogLog ---
// DSL: [0, 1, 0, 1, ...] with optional hash function lines: h1: 1, 4, 10

function parseBitArray(text: string, variant: BitArrayVariant, rows: number): BitArrayData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const allBits: number[] = [];
  const hashHighlights: HashHighlight[] = [];

  for (const line of lines) {
    const arrayMatch = line.match(/^\[(.+)\]$/);
    if (arrayMatch) {
      const inner = arrayMatch[1];
      if (inner) {
        const vals = inner.split(",").map((v) => Number(v.trim()));
        allBits.push(...vals);
      }
      continue;
    }

    // Hash function highlight: h1: 1, 4, 10
    const hashMatch = line.match(/^(\w+):\s*(.+)$/);
    if (hashMatch) {
      const name = hashMatch[1] ?? "";
      const indicesStr = hashMatch[2] ?? "";
      const indices = indicesStr.split(",").map((v) => Number(v.trim())).filter(Number.isFinite);
      if (name.length > 0) {
        hashHighlights.push({ name, indices });
      }
    }
  }

  return { type: "bit-array", variant, bits: allBits, hashHighlights, rows };
}

// --- Matrix ---
// DSL: header row then labeled rows: A [ 0, 1, 0, 1 ]

function parseMatrix(text: string): MatrixData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const rows: string[][] = [];
  const rowLabels: string[] = [];
  let colLabels: string[] = [];

  for (const line of lines) {
    // Header row (no brackets): just space-separated labels
    const bracketIdx = line.indexOf("[");
    if (bracketIdx === -1) {
      colLabels = line.trim().split(/\s+/).filter((s) => s.length > 0);
      continue;
    }

    // Data row: Label [ v1, v2, ... ]
    const label = line.slice(0, bracketIdx).trim();
    const inner = line.slice(bracketIdx + 1, line.lastIndexOf("]"));
    const values = inner.split(",").map((v) => v.trim());
    rowLabels.push(label);
    rows.push(values);
  }

  return { type: "matrix", rows, rowLabels, colLabels };
}

// --- Union-Find ---
// DSL: elements: [...], parent: [...], rank: [...]

function parseUnionFind(text: string): UnionFindData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  let elements: string[] = [];
  let parent: number[] = [];
  let rank: number[] = [];
  const pointers: DataPointerDef[] = [];

  for (const line of lines) {
    const elMatch = line.match(/^elements:\s*\[(.+)\]$/);
    if (elMatch && elMatch[1]) {
      elements = elMatch[1].split(",").map((v) => v.trim());
      continue;
    }
    const pMatch = line.match(/^parent:\s*\[(.+)\]$/);
    if (pMatch && pMatch[1]) {
      parent = pMatch[1].split(",").map((v) => Number(v.trim()));
      continue;
    }
    const rMatch = line.match(/^rank:\s*\[(.+)\]$/);
    if (rMatch && rMatch[1]) {
      rank = rMatch[1].split(",").map((v) => Number(v.trim()));
      continue;
    }
    const pointerMatch = line.match(/\^(\w+):\s*(\S+)/);
    if (pointerMatch) {
      const name = pointerMatch[1];
      const targetId = pointerMatch[2];
      if (name && targetId) pointers.push({ name, targetId });
    }
  }

  return { type: "union-find", elements, parent, rank, pointers };
}

// --- LSM Tree ---
// DSL: memtable: [...], L0: [...] [...], L1: [...]

function parseLsmTree(text: string): LsmTreeData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  let memtable: string[] = [];
  const levels: { name: string; runs: string[][] }[] = [];

  for (const line of lines) {
    const memMatch = line.match(/^memtable:\s*\[(.+)\]$/);
    if (memMatch && memMatch[1]) {
      memtable = memMatch[1].split(",").map((v) => v.trim());
      continue;
    }

    // Level lines: L0: [1, 4, 7] [2, 6, 9]
    const levelMatch = line.match(/^(L\d+):\s*(.+)$/);
    if (levelMatch) {
      const name = levelMatch[1] ?? "";
      const runsStr = levelMatch[2] ?? "";
      const runs: string[][] = [];
      for (const m of runsStr.matchAll(/\[([^\]]+)\]/g)) {
        const inner = m[1];
        if (inner) {
          runs.push(inner.split(",").map((v) => v.trim()));
        }
      }
      levels.push({ name, runs });
    }
  }

  return { type: "lsm-tree", memtable, levels };
}

// --- Fibonacci Heap ---
// DSL: tree1: (3) -> (7) -> (18), min: 3, marked: 26

function parseFibonacciHeap(text: string): FibonacciHeapData {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const trees: { rootId: string; nodes: TreeNodeDef[] }[] = [];
  let minId = "";
  let markedIds: string[] = [];

  for (const line of lines) {
    const minMatch = line.match(/^min:\s*(\S+)/);
    if (minMatch && minMatch[1]) {
      minId = minMatch[1];
      continue;
    }
    const markedMatch = line.match(/^marked:\s*(.+)$/);
    if (markedMatch && markedMatch[1]) {
      markedIds = markedMatch[1].split(",").map((v) => v.trim());
      continue;
    }

    // Tree line: treeName: (3) -> (7) -> (18) -> (24)
    const treeMatch = line.match(/^\w+:\s*(.+)$/);
    if (!treeMatch) continue;
    const content = treeMatch[1] ?? "";

    const nodeIds: string[] = [];
    for (const m of content.matchAll(/\((\w+)\)/g)) {
      const id = m[1];
      if (id) nodeIds.push(id);
    }

    if (nodeIds.length === 0) continue;

    // First node is root, rest are children in a chain
    const rootId = nodeIds[0]!;
    const treeNodes: TreeNodeDef[] = nodeIds.map((id, i) => ({
      id,
      value: id,
      children: i < nodeIds.length - 1 ? [nodeIds[i + 1]!] : [],
      annotation: "",
    }));

    trees.push({ rootId, nodes: treeNodes });
  }

  return { type: "fibonacci-heap", trees, minId, markedIds };
}
