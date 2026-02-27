// Serializer — converts mutable editable types back to the markdown DSL.
// Inverse of parseLesson + deserializeLesson. One cohesive module, deep functions.

import type {
  AnimationOverride,
  TriggerVerb,
  RegionDef,
} from "@/types/lesson";
import type {
  EditableStep,
  EditableBlock,
  EditableNarration,
  EditableRegion,
  EditableLab,
  EditableCourse,
  EditableCodeBlock,
  EditableDataBlock,
  EditableDiagramBlock,
  EditableMathBlock,
  EditableChartBlock,
  EditablePreviewBlock,
  DeepMutable,
} from "@/editor/model/types";

// --- Public API ---

export function serializeLesson(
  title: string,
  steps: readonly EditableStep[],
): string {
  const parts: string[] = [];
  parts.push(`---\ntitle: ${title}\n---\n`);

  for (const step of steps) {
    parts.push(`\n# ${step.title}\n`);

    // Interleave narration paragraphs and blocks in document order.
    // Narration comes first, then blocks — mirrors how the parser collects them.
    for (const narration of step.narration) {
      parts.push(`\n${serializeNarration(narration)}\n`);
    }

    for (const [, block] of step.blocks) {
      parts.push(`\n${serializeBlock(block)}\n`);
    }
  }

  return parts.join("");
}

export function serializeLab(lab: EditableLab): {
  yaml: string;
  instructions: string;
} {
  const yamlLines: string[] = [];

  yamlLines.push(`workspace: ${lab.workspace}`);

  if (lab.testCommand.length > 0) {
    yamlLines.push(`test: ${lab.testCommand}`);
  }

  if (lab.services.length > 0) {
    yamlLines.push("services:");
    for (const svc of lab.services) {
      yamlLines.push(`  - name: ${svc.name}`);
      yamlLines.push(`    image: ${svc.image}`);
      yamlLines.push(`    port: ${svc.port}`);
      yamlLines.push(`    hostPort: ${svc.hostPort}`);
      if (svc.healthcheck.length > 0) {
        yamlLines.push(`    healthcheck: ${svc.healthcheck}`);
      }
      const envKeys = Object.keys(svc.env);
      if (envKeys.length > 0) {
        yamlLines.push("    env:");
        for (const key of envKeys) {
          yamlLines.push(`      ${key}: ${svc.env[key]}`);
        }
      }
    }
  }

  if (lab.setup.length > 0) {
    yamlLines.push("setup:");
    for (const cmd of lab.setup) {
      yamlLines.push(`  - ${cmd}`);
    }
  }

  if (lab.openFiles.length > 0) {
    yamlLines.push("open:");
    for (const f of lab.openFiles) {
      yamlLines.push(`  - ${f}`);
    }
  }

  return {
    yaml: yamlLines.join("\n"),
    instructions: lab.instructions,
  };
}

export function serializeCourse(course: EditableCourse): string {
  const lines: string[] = [];
  lines.push(`title: ${course.title}`);
  lines.push("steps:");

  for (const step of course.steps) {
    switch (step.kind) {
      case "lesson":
        lines.push(`  - title: ${step.title}`);
        lines.push(`    kind: lesson`);
        break;
      case "lab":
        lines.push(`  - title: ${step.title}`);
        lines.push(`    kind: lab`);
        break;
    }
  }

  return lines.join("\n");
}

// --- Trigger serialization ---
// Reverse of parseTriggerAction: TriggerVerb → the text inside {{...}}

function serializeTriggerVerb(action: TriggerVerb): string {
  switch (action.verb) {
    case "show":
      return `show: ${action.target}${serializeAnimation(action.animation)}`;
    case "show-group":
      return `show-group: ${action.targets.join(", ")}${serializeAnimation(action.animation)}`;
    case "hide":
      return `hide: ${action.target}${serializeAnimation(action.animation)}`;
    case "hide-group":
      return `hide-group: ${action.targets.join(", ")}${serializeAnimation(action.animation)}`;
    case "transform":
      return `transform: ${action.from} -> ${action.to}${serializeAnimation(action.animation)}`;
    case "clear": {
      const transition = action.transition !== "fade" ? action.transition : "";
      const anim = serializeAnimation(action.animation);
      if (transition.length === 0 && anim.length === 0) return "clear";
      return `clear: ${transition}${anim}`.trim();
    }
    case "split":
      return "split";
    case "unsplit":
      return "unsplit";
    case "focus":
      return `focus: ${action.target}`;
    case "pulse":
      return `pulse: ${action.target}`;
    case "trace":
      return `trace: ${action.target}`;
    case "annotate":
      return `annotate: ${action.target} "${action.text}"`;
    case "zoom": {
      const target = action.target.length > 0 ? `${action.target} ` : "";
      return `zoom: ${target}${action.scale}x`;
    }
    case "flow":
      return `flow: ${action.target}`;
    case "pan":
      return `pan: ${action.target}`;
    case "draw":
      return `draw: ${action.target}`;
    case "play":
      return `play: ${action.target}`;
    case "advance":
      return "advance";
  }
}

function serializeAnimation(animation: AnimationOverride): string {
  if (animation.kind === "default") return "";
  const parts: string[] = [];
  parts.push(animation.effect);

  // Format duration: prefer "0.5s" style, use "300ms" for sub-100ms
  const ms = animation.durationS * 1000;
  if (ms % 1000 === 0) {
    parts.push(`${animation.durationS}s`);
  } else {
    parts.push(`${animation.durationS}s`);
  }

  parts.push(animation.easing);
  return ` ${parts.join(" ")}`;
}

// --- Narration serialization ---
// Rebuild the paragraph text with triggers inlined as {{...}} at their word positions.

function serializeNarration(narration: EditableNarration): string {
  if (narration.triggers.length === 0) return narration.text;

  // Reconstruct the original text by re-inserting trigger markers.
  // The parser strips non-advance triggers from the clean text, so we re-insert them
  // at the right word boundaries using the stored wordIndex.
  const words = narration.text.split(/\s+/).filter(Boolean);

  // Group triggers by wordIndex for stable insertion order
  const triggersByWord = new Map<number, Array<{ text: string; action: TriggerVerb }>>();
  for (const t of narration.triggers) {
    const list = triggersByWord.get(t.wordIndex);
    if (list) {
      list.push(t);
    } else {
      triggersByWord.set(t.wordIndex, [t]);
    }
  }

  const parts: string[] = [];
  for (let i = 0; i <= words.length; i++) {
    const triggers = triggersByWord.get(i);
    if (triggers) {
      for (const t of triggers) {
        if (t.action.verb === "advance") continue;
        parts.push(`{{${serializeTriggerVerb(t.action)}}}`);
      }
    }
    const word = words[i];
    if (word !== undefined) {
      parts.push(word);
    }
  }

  return parts.join(" ").trim();
}

// --- Block serialization ---
// Dispatch on block.kind, emit the code fence with metadata and content.

function serializeBlock(block: EditableBlock): string {
  switch (block.kind) {
    case "code":
      return serializeCodeBlock(block);
    case "data":
      return serializeDataBlock(block);
    case "diagram":
      return serializeDiagramBlock(block);
    case "math":
      return serializeMathBlock(block);
    case "chart":
      return serializeChartBlock(block);
    case "preview":
      return serializePreviewBlock(block);
  }
}

// --- Code block ---

function serializeCodeBlock(block: EditableCodeBlock): string {
  const fence = "```";
  const langTag = `code:${block.name} lang=${block.lang}`;

  // Re-insert inline annotations on their respective lines
  const lines = block.content.split("\n");
  const annotationsByLine = new Map<number, string>();
  for (const anno of block.annotations) {
    annotationsByLine.set(anno.line, anno.text);
  }

  const contentLines: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const annoText = annotationsByLine.get(i + 1);
    if (annoText !== undefined) {
      contentLines.push(`${line} // !${annoText}`);
    } else {
      contentLines.push(line);
    }
  }

  const body = contentLines.join("\n");
  const regionFooter = serializeRegions(block.regions);
  const content = regionFooter.length > 0 ? `${body}\n---\n${regionFooter}` : body;

  return `${fence}${langTag}\n${content}\n${fence}`;
}

// --- Data block ---

function serializeDataBlock(block: EditableDataBlock): string {
  const fence = "```";
  const data = block.data;
  const dataType = data.type;

  // Build the header: data:name type=dataType [extra params]
  let header = `data:${block.name} type=${dataType}`;
  if (data.type === "graph") {
    header += ` layout=${data.layout}`;
  }
  if (data.type === "tree" && data.variant !== "generic") {
    header += ` variant=${data.variant}`;
  }
  if (data.type === "ring-buffer") {
    header += ` capacity=${data.capacity}`;
  }
  if (data.type === "b-tree") {
    header += ` variant=${data.variant} order=${data.order}`;
  }
  if (data.type === "trie" && data.variant !== "trie") {
    header += ` variant=${data.variant}`;
  }
  if (data.type === "bit-array") {
    header += ` variant=${data.variant}`;
    if (data.rows > 1) header += ` rows=${data.rows}`;
  }

  const body = serializeDataContent(data);
  const regionFooter = serializeRegions(block.regions);
  const content = regionFooter.length > 0 ? `${body}\n---\n${regionFooter}` : body;

  return `${fence}${header}\n${content}\n${fence}`;
}

type MutableDataUnion = DeepMutable<
  import("@/types/lesson").DataState["data"]
>;

function serializeDataContent(data: MutableDataUnion): string {
  switch (data.type) {
    case "array":
      return serializeArray(data);
    case "linked-list":
      return serializeLinkedList(data);
    case "tree":
      return serializeTree(data);
    case "graph":
      return serializeGraph(data);
    case "stack":
      return serializeStack(data);
    case "queue":
      return serializeQueue(data);
    case "deque":
      return serializeDeque(data);
    case "ring-buffer":
      return serializeRingBuffer(data);
    case "doubly-linked-list":
      return serializeDoublyLinkedList(data);
    case "skip-list":
      return serializeSkipList(data);
    case "hash-map":
      return serializeHashMap(data);
    case "b-tree":
      return serializeBTree(data);
    case "trie":
      return serializeTrie(data);
    case "bit-array":
      return serializeBitArray(data);
    case "matrix":
      return serializeMatrix(data);
    case "union-find":
      return serializeUnionFind(data);
    case "lsm-tree":
      return serializeLsmTree(data);
    case "fibonacci-heap":
      return serializeFibonacciHeap(data);
  }
}

function serializeArray(data: DeepMutable<import("@/types/lesson").ArrayData>): string {
  const lines: string[] = [];
  lines.push(`[${data.values.join(", ")}]`);
  for (const p of data.pointers) {
    lines.push(`^${p.name}=${p.targetId}`);
  }
  return lines.join("\n");
}

function serializeLinkedList(
  data: DeepMutable<import("@/types/lesson").LinkedListData>,
): string {
  const lines: string[] = [];

  // Main chain: nodes connected by edges, determine the chain order from edges
  const mainNodes = data.floatingGroups.length > 0
    ? data.nodes.filter(
        (n) => !data.floatingGroups.some((g) => g.some((gn) => gn.id === n.id)),
      )
    : data.nodes;

  const chainLine = mainNodes
    .map((n) => `(${n.id} ${n.value})`)
    .join(" -> ");
  lines.push(data.hasNull ? `${chainLine} -> null` : chainLine);

  // Pointer lines
  for (const p of data.pointers) {
    lines.push(`^${p.name}`);
  }

  // Floating groups separated by blank lines
  for (const group of data.floatingGroups) {
    lines.push("");
    const groupLine = group.map((n) => `(${n.id} ${n.value})`).join(" -> ");
    lines.push(groupLine);
  }

  return lines.join("\n");
}

function serializeTree(
  data: DeepMutable<import("@/types/lesson").TreeData>,
): string {
  const lines: string[] = [];

  // Build a lookup for node by id
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  // Emit using indentation format
  function emitNode(id: string, depth: number): void {
    const node = nodeById.get(id);
    if (!node) return;
    const indent = "  ".repeat(depth);
    const annotation = node.annotation.length > 0 ? `:${node.annotation}` : "";
    lines.push(`${indent}(${node.value}${annotation})`);
    for (const childId of node.children) {
      emitNode(childId, depth + 1);
    }
  }

  if (data.rootId.length > 0) {
    emitNode(data.rootId, 0);
  }

  // Pointers
  for (const p of data.pointers) {
    lines.push(`^${p.name}: ${p.targetId}`);
  }

  return lines.join("\n");
}

function serializeGraph(
  data: DeepMutable<import("@/types/lesson").GraphData>,
): string {
  const lines: string[] = [];
  const arrow = data.directed ? "->" : "--";

  // Group edges by source
  const edgesByFrom = new Map<string, Array<{ toId: string; weight: string }>>();
  for (const e of data.edges) {
    const list = edgesByFrom.get(e.fromId);
    if (list) {
      list.push(e);
    } else {
      edgesByFrom.set(e.fromId, [e]);
    }
  }

  // Emit edges grouped by source
  for (const [fromId, edges] of edgesByFrom) {
    for (const e of edges) {
      const weight = e.weight.length > 0 ? `: ${e.weight}` : "";
      lines.push(`${fromId} ${arrow} ${e.toId}${weight}`);
    }
  }

  // Emit isolated nodes (no edges)
  const connectedNodes = new Set<string>();
  for (const e of data.edges) {
    connectedNodes.add(e.fromId);
    connectedNodes.add(e.toId);
  }

  // Pointers
  for (const p of data.pointers) {
    lines.push(`^${p.name}: ${p.targetId}`);
  }

  return lines.join("\n");
}

function serializeStack(
  data: DeepMutable<import("@/types/lesson").StackData>,
): string {
  const lines: string[] = [];
  lines.push(`[${data.values.join(", ")}]`);
  if (data.topIndex >= 0 && data.topIndex !== data.values.length - 1) {
    lines.push(`^top=${data.topIndex}`);
  }
  return lines.join("\n");
}

function serializeQueue(
  data: DeepMutable<import("@/types/lesson").QueueData>,
): string {
  const lines: string[] = [];
  lines.push(`[${data.values.join(", ")}]`);
  const pointerParts: string[] = [];
  if (data.front !== 0) pointerParts.push(`^front=${data.front}`);
  if (data.rear !== data.values.length - 1) pointerParts.push(`^rear=${data.rear}`);
  for (const p of data.pointers) {
    pointerParts.push(`^${p.name}=${p.targetId}`);
  }
  if (pointerParts.length > 0) lines.push(pointerParts.join(" "));
  return lines.join("\n");
}

function serializeDeque(
  data: DeepMutable<import("@/types/lesson").DequeData>,
): string {
  // Same format as queue
  const lines: string[] = [];
  lines.push(`[${data.values.join(", ")}]`);
  const pointerParts: string[] = [];
  if (data.front !== 0) pointerParts.push(`^front=${data.front}`);
  if (data.rear !== data.values.length - 1) pointerParts.push(`^rear=${data.rear}`);
  for (const p of data.pointers) {
    pointerParts.push(`^${p.name}=${p.targetId}`);
  }
  if (pointerParts.length > 0) lines.push(pointerParts.join(" "));
  return lines.join("\n");
}

function serializeRingBuffer(
  data: DeepMutable<import("@/types/lesson").RingBufferData>,
): string {
  const lines: string[] = [];
  lines.push(`[${data.values.join(", ")}]`);
  lines.push(`^head=${data.head} ^tail=${data.tail}`);
  return lines.join("\n");
}

function serializeDoublyLinkedList(
  data: DeepMutable<import("@/types/lesson").DoublyLinkedListData>,
): string {
  const lines: string[] = [];
  const chainLine = data.nodes.map((n) => `(${n.id} ${n.value})`).join(" <-> ");
  lines.push(data.hasNull ? `${chainLine} -> null` : chainLine);
  for (const p of data.pointers) {
    lines.push(`^${p.name}: ${p.targetId}`);
  }
  return lines.join("\n");
}

function serializeSkipList(
  data: DeepMutable<import("@/types/lesson").SkipListData>,
): string {
  const lines: string[] = [];
  // Levels are stored descending by level number
  for (const level of data.levels) {
    const nodeStr = level.nodeIds.map((id) => `(${id})`).join(" -> ");
    lines.push(`L${level.level}: ${nodeStr}`);
  }
  for (const p of data.pointers) {
    lines.push(`^${p.name}: ${p.targetId}`);
  }
  return lines.join("\n");
}

function serializeHashMap(
  data: DeepMutable<import("@/types/lesson").HashMapData>,
): string {
  const lines: string[] = [];
  for (const bucket of data.buckets) {
    const chain = bucket.chain.map((n) => `(${n.id} ${n.value})`).join(" -> ");
    lines.push(`${bucket.index}: ${chain}`);
  }
  return lines.join("\n");
}

function serializeBTree(
  data: DeepMutable<import("@/types/lesson").BTreeData>,
): string {
  const lines: string[] = [];
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  function emitNode(id: string, depth: number): void {
    const node = nodeById.get(id);
    if (!node) return;
    const indent = "  ".repeat(depth);
    lines.push(`${indent}(${node.id}: ${node.keys.join(", ")})`);
    for (const childId of node.children) {
      emitNode(childId, depth + 1);
    }
  }

  if (data.rootId.length > 0) {
    emitNode(data.rootId, 0);
  }

  for (const p of data.pointers) {
    lines.push(`^${p.name}: ${p.targetId}`);
  }

  return lines.join("\n");
}

function serializeTrie(
  data: DeepMutable<import("@/types/lesson").TrieData>,
): string {
  const lines: string[] = [];
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));

  function emitNode(id: string, depth: number): void {
    const node = nodeById.get(id);
    if (!node) return;
    const indent = "  ".repeat(depth);
    const terminal = node.terminal ? "*" : "";
    lines.push(`${indent}(${node.value}${terminal})`);
    for (const childId of node.children) {
      emitNode(childId, depth + 1);
    }
  }

  if (data.rootId.length > 0) {
    emitNode(data.rootId, 0);
  }

  for (const p of data.pointers) {
    lines.push(`^${p.name}: ${p.targetId}`);
  }

  return lines.join("\n");
}

function serializeBitArray(
  data: DeepMutable<import("@/types/lesson").BitArrayData>,
): string {
  const lines: string[] = [];
  lines.push(`[${data.bits.join(", ")}]`);
  for (const h of data.hashHighlights) {
    lines.push(`${h.name}: ${h.indices.join(", ")}`);
  }
  return lines.join("\n");
}

function serializeMatrix(
  data: DeepMutable<import("@/types/lesson").MatrixData>,
): string {
  const lines: string[] = [];
  if (data.colLabels.length > 0) {
    // Pad to align with row labels
    const labelWidth = Math.max(...data.rowLabels.map((l) => l.length), 0);
    lines.push(`${" ".repeat(labelWidth)}  ${data.colLabels.join("  ")}`);
  }
  for (let i = 0; i < data.rows.length; i++) {
    const row = data.rows[i];
    const label = data.rowLabels[i] ?? "";
    if (row) {
      lines.push(`${label} [${row.join(", ")}]`);
    }
  }
  return lines.join("\n");
}

function serializeUnionFind(
  data: DeepMutable<import("@/types/lesson").UnionFindData>,
): string {
  const lines: string[] = [];
  lines.push(`elements: [${data.elements.join(", ")}]`);
  lines.push(`parent: [${data.parent.join(", ")}]`);
  if (data.rank.length > 0) {
    lines.push(`rank: [${data.rank.join(", ")}]`);
  }
  for (const p of data.pointers) {
    lines.push(`^${p.name}: ${p.targetId}`);
  }
  return lines.join("\n");
}

function serializeLsmTree(
  data: DeepMutable<import("@/types/lesson").LsmTreeData>,
): string {
  const lines: string[] = [];
  lines.push(`memtable: [${data.memtable.join(", ")}]`);
  for (const level of data.levels) {
    const runs = level.runs.map((r) => `[${r.join(", ")}]`).join(" ");
    lines.push(`${level.name}: ${runs}`);
  }
  return lines.join("\n");
}

function serializeFibonacciHeap(
  data: DeepMutable<import("@/types/lesson").FibonacciHeapData>,
): string {
  const lines: string[] = [];
  for (let i = 0; i < data.trees.length; i++) {
    const tree = data.trees[i]!;
    const nodeStr = tree.nodes.map((n) => `(${n.id})`).join(" -> ");
    lines.push(`tree${i}: ${nodeStr}`);
  }
  if (data.minId.length > 0) {
    lines.push(`min: ${data.minId}`);
  }
  if (data.markedIds.length > 0) {
    lines.push(`marked: ${data.markedIds.join(", ")}`);
  }
  return lines.join("\n");
}

// --- Diagram block ---

function serializeDiagramBlock(block: EditableDiagramBlock): string {
  const fence = "```";
  const header = `diagram:${block.name}`;
  const lines: string[] = [];

  // Nodes
  for (const node of block.nodes) {
    const typeAttr = node.nodeType !== "service" ? node.nodeType : "service";
    const iconAttr = node.icon !== undefined ? ` icon=${node.icon}` : "";
    lines.push(`${node.id} [${typeAttr}${iconAttr}]`);
  }

  // Edges
  for (const edge of block.edges) {
    if (edge.label.length > 0) {
      lines.push(`${edge.fromId} --${edge.label}--> ${edge.toId}`);
    } else {
      lines.push(`${edge.fromId} --> ${edge.toId}`);
    }
  }

  // Groups
  for (const group of block.groups) {
    lines.push(`{${group.name}: ${group.memberIds.join(", ")}}`);
  }

  const body = lines.join("\n");
  const regionFooter = serializeRegions(block.regions);
  const content = regionFooter.length > 0 ? `${body}\n---\n${regionFooter}` : body;

  return `${fence}${header}\n${content}\n${fence}`;
}

// --- Math block ---

function serializeMathBlock(block: EditableMathBlock): string {
  const fence = "```";
  const header = `math:${block.name}`;

  // Expressions separated by blank lines
  const body = block.expressions.map((e) => e.latex).join("\n\n");
  const regionFooter = serializeRegions(block.regions);
  const content = regionFooter.length > 0 ? `${body}\n---\n${regionFooter}` : body;

  return `${fence}${header}\n${content}\n${fence}`;
}

// --- Chart block ---

function serializeChartBlock(block: EditableChartBlock): string {
  const fence = "```";
  const header = `chart:${block.name} type=${block.chartKind}`;
  const lines: string[] = [];

  // Single-series "default" → simple format
  if (block.series.length === 1 && block.series[0]!.name === "default") {
    for (const point of block.series[0]!.data) {
      lines.push(`${point.label}: ${point.value}`);
    }
  } else if (block.series.length > 0) {
    // Multi-series → table format
    const firstSeries = block.series[0]!;
    const labels = firstSeries.data.map((d) => d.label);
    const seriesNames = block.series.map((s) => s.name);

    lines.push(`| ${["x", ...seriesNames].join(" | ")} |`);
    lines.push(`| ${["---", ...seriesNames.map(() => "---")].join(" | ")} |`);
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i]!;
      const values = block.series.map((s) => String(s.data[i]?.value ?? 0));
      lines.push(`| ${[label, ...values].join(" | ")} |`);
    }
  }

  // Decorations
  for (const sr of block.shadedRegions) {
    lines.push(`shade: ${sr.from}..${sr.to} ${sr.color}`);
  }
  for (const anno of block.annotations) {
    lines.push(`annotate: ${anno.label} "${anno.text}"`);
  }

  const body = lines.join("\n");
  const regionFooter = serializeRegions(block.regions);
  const content = regionFooter.length > 0 ? `${body}\n---\n${regionFooter}` : body;

  return `${fence}${header}\n${content}\n${fence}`;
}

// --- Preview block ---

function serializePreviewBlock(block: EditablePreviewBlock): string {
  const fence = "```";
  const templateParam = block.template !== "html" ? ` template=${block.template}` : "";
  const header = `preview:${block.name}${templateParam}`;

  const regionFooter = serializeRegions(block.regions);
  const content = regionFooter.length > 0
    ? `${block.source}\n---\n${regionFooter}`
    : block.source;

  return `${fence}${header}\n${content}\n${fence}`;
}

// --- Region footer ---

function serializeRegions(regions: readonly (RegionDef | EditableRegion)[]): string {
  if (regions.length === 0) return "";
  return regions.map((r) => `${r.name}: ${r.target}`).join("\n");
}
