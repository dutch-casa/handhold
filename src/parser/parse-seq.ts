import type { VisualizationState, DataState, DiagramState } from "@/types/lesson";
import type {
  GraphData,
  LinkedListData,
  TreeData,
  BTreeData,
  SkipListData,
  HashMapData,
  UnionFindData,
  DoublyLinkedListData,
  BitArrayData,
} from "@/types/lesson";

// Seq block: a generator that yields animation commands at parse time.
// Pure module — no side effects, no DOM, no React.

// --- Public types ---

export type SeqBlockDef = {
  readonly source: string;
  readonly targetBlock: string;
};

export type SeqCommand =
  | { readonly kind: "narrate"; readonly text: string }
  | { readonly kind: "verb"; readonly verb: string; readonly target: string };

// --- Execution ---

const MAX_YIELDS = 10_000;

export function executeSeq(source: string, dataApi: unknown): readonly SeqCommand[] {
  const helpers = buildHelpers();
  const names = Object.keys(helpers);
  const values = names.map((n) => helpers[n]);

  try {
    const factory = new Function(
      ...names,
      `function* __seq(data) {\n${source}\n}\nreturn __seq;`,
    );
    const gen = factory(...values)(dataApi);

    const commands: SeqCommand[] = [];
    let n = 0;
    for (const cmd of gen) {
      if (++n > MAX_YIELDS) {
        throw new Error(`seq exceeded ${MAX_YIELDS} yields`);
      }
      commands.push(cmd as SeqCommand);
    }
    return commands;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return [{ kind: "narrate", text: `[seq error: ${msg}]` }];
  }
}

// --- Serialization ---

export function serializeSeq(commands: readonly SeqCommand[]): string {
  const parts: string[] = [];
  for (const cmd of commands) {
    if (cmd.kind === "narrate") {
      parts.push(cmd.text);
    } else {
      parts.push(`{{${cmd.verb}: ${cmd.target}}}`);
    }
  }
  return parts.join(" ");
}

// --- Data API builders ---

export function buildDataApi(block: VisualizationState): unknown {
  switch (block.kind) {
    case "data":
      return buildFromData(block.data);
    case "diagram":
      return buildFromDiagram(block);
    default:
      return {};
  }
}

function buildFromData(data: DataState["data"]): unknown {
  switch (data.type) {
    case "graph":
      return graphApi(data);
    case "linked-list":
      return linkedListApi(data);
    case "doubly-linked-list":
      return doublyLinkedListApi(data);
    case "tree":
      return treeApi(data);
    case "b-tree":
      return bTreeApi(data);
    case "skip-list":
      return skipListApi(data);
    case "hash-map":
      return hashMapApi(data);
    case "union-find":
      return unionFindApi(data);
    case "bit-array":
      return bitArrayApi(data);
    case "array":
    case "queue":
    case "deque":
      return { values: [...data.values], length: data.values.length };
    case "stack":
      return { values: [...data.values], topIndex: data.topIndex };
    case "ring-buffer":
      return { values: [...data.values], head: data.head, tail: data.tail, capacity: data.capacity };
    case "trie":
      return { nodes: data.nodes.map((n) => n.id), rootId: data.rootId };
    case "matrix":
      return { rows: data.rows, rowLabels: data.rowLabels, colLabels: data.colLabels };
    case "lsm-tree":
      return { memtable: [...data.memtable], levels: data.levels };
    case "fibonacci-heap":
      return { trees: data.trees, minId: data.minId, markedIds: [...data.markedIds] };
  }
}

function graphApi(data: GraphData) {
  const adj = new Map<string, string[]>();
  for (const node of data.nodes) adj.set(node.id, []);
  for (const edge of data.edges) {
    adj.get(edge.fromId)?.push(edge.toId);
    if (!data.directed) adj.get(edge.toId)?.push(edge.fromId);
  }

  return {
    nodes: data.nodes.map((n) => n.id),
    edges: data.edges.map((e) => ({ from: e.fromId, to: e.toId, weight: e.weight })),
    directed: data.directed,
    neighbors: (id: string) => adj.get(id) ?? [],
    value: (id: string) => data.nodes.find((n) => n.id === id)?.value ?? "",
  };
}

function linkedListApi(data: LinkedListData) {
  const nextMap = new Map<string, string>();
  for (const edge of data.edges) nextMap.set(edge.fromId, edge.toId);
  const targeted = new Set(data.edges.map((e) => e.toId));
  const head = data.nodes.find((n) => !targeted.has(n.id))?.id ?? null;

  return {
    nodes: data.nodes.map((n) => n.id),
    head,
    next: (id: string) => nextMap.get(id) ?? null,
    value: (id: string) => data.nodes.find((n) => n.id === id)?.value ?? "",
  };
}

function treeApi(data: TreeData) {
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const parentMap = new Map<string, string>();
  for (const node of data.nodes) {
    for (const childId of node.children) {
      parentMap.set(childId, node.id);
    }
  }

  function depthOf(id: string): number {
    let d = 0;
    let current = id;
    while (parentMap.has(current)) {
      current = parentMap.get(current)!;
      d++;
    }
    return d;
  }

  function subtreeOf(id: string): string[] {
    const result: string[] = [];
    const stack = [id];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      result.push(cur);
      const node = nodeMap.get(cur);
      if (node) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          const child = node.children[i];
          if (child) stack.push(child);
        }
      }
    }
    return result;
  }

  function inorder(id: string): string[] {
    const node = nodeMap.get(id);
    if (!node) return [];
    if (node.children.length === 0) return [id];
    const left = node.children[0] ? inorder(node.children[0]) : [];
    const right = node.children[1] ? inorder(node.children[1]) : [];
    return [...left, id, ...right];
  }

  function preorder(id: string): string[] {
    const node = nodeMap.get(id);
    if (!node) return [];
    return [id, ...node.children.flatMap((c) => preorder(c))];
  }

  function postorder(id: string): string[] {
    const node = nodeMap.get(id);
    if (!node) return [];
    return [...node.children.flatMap((c) => postorder(c)), id];
  }

  return {
    root: data.rootId,
    nodes: data.nodes.map((n) => n.id),
    children: (id: string) => [...(nodeMap.get(id)?.children ?? [])],
    parent: (id: string) => parentMap.get(id) ?? null,
    value: (id: string) => nodeMap.get(id)?.value ?? "",
    annotation: (id: string) => nodeMap.get(id)?.annotation ?? "",
    depth: depthOf,
    subtree: subtreeOf,
    isLeaf: (id: string) => (nodeMap.get(id)?.children.length ?? 0) === 0,
    left: (id: string) => nodeMap.get(id)?.children[0] ?? null,
    right: (id: string) => nodeMap.get(id)?.children[1] ?? null,
    inorder: () => data.rootId ? inorder(data.rootId) : [],
    preorder: () => data.rootId ? preorder(data.rootId) : [],
    postorder: () => data.rootId ? postorder(data.rootId) : [],
  };
}

function doublyLinkedListApi(data: DoublyLinkedListData) {
  const nextMap = new Map<string, string>();
  const prevMap = new Map<string, string>();
  for (const edge of data.edges) {
    nextMap.set(edge.fromId, edge.toId);
    prevMap.set(edge.toId, edge.fromId);
  }
  const targeted = new Set(data.edges.map((e) => e.toId));
  const head = data.nodes.find((n) => !targeted.has(n.id))?.id ?? null;

  return {
    nodes: data.nodes.map((n) => n.id),
    head,
    next: (id: string) => nextMap.get(id) ?? null,
    prev: (id: string) => prevMap.get(id) ?? null,
    value: (id: string) => data.nodes.find((n) => n.id === id)?.value ?? "",
  };
}

function bTreeApi(data: BTreeData) {
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));

  function searchPath(key: string): { path: string[]; found: boolean } {
    const path: string[] = [];
    let current = data.rootId;
    while (current) {
      path.push(current);
      const node = nodeMap.get(current);
      if (!node) break;
      if (node.keys.includes(key)) return { path, found: true };
      // Find which child to descend into
      let childIdx = node.keys.length;
      for (let i = 0; i < node.keys.length; i++) {
        const k = node.keys[i];
        if (k && key < k) { childIdx = i; break; }
      }
      current = node.children[childIdx] ?? "";
      if (!current) break;
    }
    return { path, found: false };
  }

  return {
    root: data.rootId,
    keys: (nodeId: string) => [...(nodeMap.get(nodeId)?.keys ?? [])],
    children: (nodeId: string) => [...(nodeMap.get(nodeId)?.children ?? [])],
    search: searchPath,
  };
}

function skipListApi(data: SkipListData) {
  const nodeValues = new Map(data.nodes.map((n) => [n.id, n.value]));

  return {
    levels: data.levels.map((l) => ({ level: l.level, nodeIds: [...l.nodeIds] })),
    height: (nodeId: string) => data.levels.filter((l) => l.nodeIds.includes(nodeId)).length,
    value: (nodeId: string) => nodeValues.get(nodeId) ?? "",
    search: (value: string) => {
      const path: { level: number; nodeId: string }[] = [];
      for (const level of data.levels) {
        for (const nodeId of level.nodeIds) {
          path.push({ level: level.level, nodeId });
          if (nodeValues.get(nodeId) === value) return { path, found: true };
        }
      }
      return { path, found: false };
    },
  };
}

function hashMapApi(data: HashMapData) {
  return {
    buckets: data.buckets.map((b) => ({
      index: b.index,
      chain: b.chain.map((n) => n.id),
    })),
    chainAt: (bucketIndex: number) => {
      const bucket = data.buckets.find((b) => b.index === bucketIndex);
      return bucket ? bucket.chain.map((n) => n.id) : [];
    },
  };
}

function unionFindApi(data: UnionFindData) {
  function findRoot(idx: number): number {
    let current = idx;
    while (true) {
      const parent = data.parent[current];
      if (parent === undefined || parent === current) return current;
      current = parent;
    }
  }

  return {
    elements: [...data.elements],
    find: (element: string) => {
      const idx = data.elements.indexOf(element);
      if (idx === -1) return null;
      const rootIdx = findRoot(idx);
      return data.elements[rootIdx] ?? null;
    },
    connected: (a: string, b: string) => {
      const ai = data.elements.indexOf(a);
      const bi = data.elements.indexOf(b);
      if (ai === -1 || bi === -1) return false;
      return findRoot(ai) === findRoot(bi);
    },
    sets: () => {
      const groups = new Map<number, string[]>();
      for (let i = 0; i < data.elements.length; i++) {
        const root = findRoot(i);
        const group = groups.get(root) ?? [];
        const el = data.elements[i];
        if (el) group.push(el);
        groups.set(root, group);
      }
      return [...groups.values()];
    },
  };
}

function bitArrayApi(data: BitArrayData) {
  const hashMap = new Map(data.hashHighlights.map((h) => [h.name, h.indices]));

  return {
    bits: [...data.bits],
    isSet: (index: number) => (data.bits[index] ?? 0) > 0,
    hashIndices: (name: string) => [...(hashMap.get(name) ?? [])],
  };
}

function buildFromDiagram(state: DiagramState) {
  const adj = new Map<string, string[]>();
  for (const node of state.nodes) adj.set(node.id, []);
  for (const edge of state.edges) adj.get(edge.fromId)?.push(edge.toId);

  return {
    nodes: state.nodes.map((n) => n.id),
    edges: state.edges.map((e) => ({ from: e.fromId, to: e.toId, label: e.label })),
    neighbors: (id: string) => adj.get(id) ?? [],
  };
}

// --- Generator helpers ---

function buildHelpers(): Record<string, (...args: unknown[]) => SeqCommand> {
  const verb =
    (v: string) =>
    (target: unknown): SeqCommand => ({ kind: "verb", verb: v, target: String(target) });

  return {
    narrate: (text: unknown): SeqCommand => ({ kind: "narrate", text: String(text) }),
    pulse: verb("pulse"),
    draw: verb("draw"),
    focus: verb("focus"),
    flow: verb("flow"),
    trace: verb("trace"),
    pan: verb("pan"),
    show: verb("show"),
    hide: verb("hide"),
    zoom: (scale: unknown, target?: unknown): SeqCommand => ({
      kind: "verb",
      verb: "zoom",
      target: target != null ? `${String(target)} ${Number(scale)}x` : `${Number(scale)}x`,
    }),
    annotate: (target: unknown, text: unknown): SeqCommand => ({
      kind: "verb",
      verb: "annotate",
      target: `${String(target)} "${String(text)}"`,
    }),
    clear: (transition?: unknown): SeqCommand => ({
      kind: "verb",
      verb: "clear",
      target: transition != null ? String(transition) : "fade",
    }),
  };
}
