import type { VisualizationState, DataState, DiagramState } from "@/types/lesson";
import type { GraphData, LinkedListData, BinaryTreeData } from "@/types/lesson";

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
    case "binary-tree":
      return binaryTreeApi(data);
    case "array":
      return { values: [...data.values], length: data.values.length };
    case "stack":
      return { values: [...data.values], topIndex: data.topIndex };
    case "hash-map":
      return { buckets: data.buckets.map((b) => ({ index: b.index, chain: [...b.chain] })) };
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

function binaryTreeApi(data: BinaryTreeData) {
  const childMap = new Map<string, { left: string | null; right: string | null }>();
  const byParent = new Map<string, string[]>();
  for (const edge of data.edges) {
    const arr = byParent.get(edge.fromId) ?? [];
    arr.push(edge.toId);
    byParent.set(edge.fromId, arr);
  }
  for (const node of data.nodes) {
    const children = byParent.get(node.id) ?? [];
    childMap.set(node.id, { left: children[0] ?? null, right: children[1] ?? null });
  }
  const targeted = new Set(data.edges.map((e) => e.toId));
  const root = data.nodes.find((n) => !targeted.has(n.id))?.id ?? null;

  return {
    nodes: data.nodes.map((n) => n.id),
    root,
    left: (id: string) => childMap.get(id)?.left ?? null,
    right: (id: string) => childMap.get(id)?.right ?? null,
    value: (id: string) => data.nodes.find((n) => n.id === id)?.value ?? "",
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
