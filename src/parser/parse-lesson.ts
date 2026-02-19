import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import { parse as parseYaml } from "yaml";
import { parseData } from "./parse-data";
import { parseDiagram } from "./parse-diagram";
import { parseMath } from "./parse-math";
import { parseChart } from "./parse-chart";
import { parsePreview } from "./parse-preview";
import { splitContentAndRegions } from "./parse-regions";
import { buildSceneSequence } from "./build-scenes";
import { parseAnimationTokens, isAnimationToken } from "./parse-animation";
import type {
  ParsedLesson,
  LessonStep,
  NarrationBlock,
  VisualizationState,
  CodeState,
  FocusRange,
  CodeAnnotation,
  Trigger,
  TriggerVerb,
  GraphLayoutKind,
  PreviewTemplate,
  LessonDiagnostic,
  DiagnosticLocation,
} from "@/types/lesson";
import { DEFAULT_ANIMATION } from "@/types/lesson";

// --- MDAST node types (subset we care about) ---

type MdastNode = {
  type: string;
  depth?: number;
  value?: string;
  lang?: string;
  meta?: string;
  children?: MdastNode[];
};

// --- Parsed block metadata from code fence lang/meta ---

type BlockMeta = {
  readonly blockKind: string;
  readonly name: string;
  readonly params: ReadonlyMap<string, string>;
};

// --- Main entry ---

export function parseLesson(markdown: string): ParsedLesson {
  const tree = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .parse(markdown) as MdastNode;

  const title = extractTitle(tree);
  const { steps, diagnostics } = extractSteps(tree);

  return { title, steps, diagnostics };
}

// --- Frontmatter ---

function extractTitle(tree: MdastNode): string {
  const yamlNode = tree.children?.find((n) => n.type === "yaml");
  if (!yamlNode?.value) return "Untitled";
  const fm = parseYaml(yamlNode.value) as Record<string, unknown>;
  return typeof fm["title"] === "string" ? fm["title"] : "Untitled";
}

// --- Step extraction ---

function extractSteps(tree: MdastNode): {
  readonly steps: LessonStep[];
  readonly diagnostics: readonly LessonDiagnostic[];
} {
  const children = tree.children ?? [];
  const steps: LessonStep[] = [];
  const diagnostics: LessonDiagnostic[] = [];

  let currentTitle = "";
  let currentNodes: MdastNode[] = [];

  function flushStep() {
    if (currentNodes.length === 0) return;
    const { step, diagnostics: stepDiagnostics } = buildStep(
      currentTitle,
      currentNodes,
      steps.length,
    );
    steps.push(step);
    diagnostics.push(...stepDiagnostics);
    currentNodes = [];
  }

  for (const node of children) {
    if (node.type === "yaml") continue;

    if (node.type === "heading" && node.depth === 1) {
      flushStep();
      currentTitle = extractText(node);
      continue;
    }

    currentNodes.push(node);
  }

  flushStep();
  return { steps, diagnostics };
}

function buildStep(
  title: string,
  nodes: MdastNode[],
  index: number,
): { readonly step: LessonStep; readonly diagnostics: readonly LessonDiagnostic[] } {
  const narration: NarrationBlock[] = [];
  const blocks = new Map<string, VisualizationState>();
  const kindCounters = new Map<string, number>();

  for (const node of nodes) {
    if (node.type === "paragraph") {
      narration.push(parseNarrationBlock(node));
      continue;
    }


    if (node.type === "code") {
      const vis = parseCodeFence(node, kindCounters);
      if (vis) blocks.set(vis.name, vis);
      continue;
    }
  }

  const scenes = buildSceneSequence(blocks, narration);

  const step: LessonStep = {
    id: `step-${index}`,
    title,
    narration,
    blocks,
    scenes,
  };

  const diagnostics = validateStep(step, narration, blocks);

  return { step, diagnostics };
}

// --- Block metadata extraction ---
// Fence lang field: `kind:name` or bare `kind`
// Meta string: `key=value` pairs and legacy `filename [focus N]`

function parseBlockMeta(rawLang: string, meta: string): BlockMeta {
  const colonIdx = rawLang.indexOf(":");
  let blockKind: string;
  let name: string;

  if (colonIdx !== -1) {
    blockKind = rawLang.slice(0, colonIdx);
    name = rawLang.slice(colonIdx + 1);
  } else {
    blockKind = rawLang;
    name = "";
  }

  const params = new Map<string, string>();
  for (const token of meta.split(/\s+/)) {
    const eqIdx = token.indexOf("=");
    if (eqIdx !== -1) {
      const key = token.slice(0, eqIdx);
      const val = token.slice(eqIdx + 1);
      if (key.length > 0) params.set(key, val);
    }
  }

  return { blockKind, name, params };
}

function autoName(
  kind: string,
  explicitName: string,
  counters: Map<string, number>,
): string {
  if (explicitName.length > 0) return explicitName;
  const count = counters.get(kind) ?? 0;
  counters.set(kind, count + 1);
  return `${kind}-${count}`;
}

// --- Trigger verb parsing ---

const VERB_KEYWORDS = new Set([
  "show",
  "show-group",
  "hide",
  "hide-group",
  "transform",
  "clear",
  "split",
  "unsplit",
  "focus",
  "pulse",
  "trace",
  "annotate",
  "zoom",
  "flow",
]);

export function parseTriggerAction(text: string): TriggerVerb {
  const trimmed = text.trim();

  // Verb: args — e.g. "show: hash-fn slide 0.5s", "clear: slide"
  const colonIdx = trimmed.indexOf(":");
  if (colonIdx !== -1) {
    const verb = trimmed.slice(0, colonIdx).trim();
    const args = trimmed.slice(colonIdx + 1).trim();
    const tokens = args.split(/\s+/).filter(Boolean);

    switch (verb) {
      case "show": {
        const target = tokens[0] ?? "";
        const animation = parseAnimationTokens(tokens.slice(1));
        return { verb: "show", target, animation };
      }
      case "show-group": {
        const { headTokens, animTokens } = splitAnimationTokens(tokens);
        const targets = parseTargetList(headTokens);
        const animation = parseAnimationTokens(animTokens);
        return { verb: "show-group", targets, animation };
      }
      case "hide": {
        const target = tokens[0] ?? "";
        const animation = parseAnimationTokens(tokens.slice(1));
        return { verb: "hide", target, animation };
      }
      case "hide-group": {
        const { headTokens, animTokens } = splitAnimationTokens(tokens);
        const targets = parseTargetList(headTokens);
        const animation = parseAnimationTokens(animTokens);
        return { verb: "hide-group", targets, animation };
      }
      case "transform": {
        const { headTokens, animTokens } = splitAnimationTokens(tokens);
        const pair = headTokens.join(" ").trim();
        const [from, to] = pair
          .split(/\s*->\s*/)
          .map((t) => t.trim())
          .filter(Boolean);
        const animation = parseAnimationTokens(animTokens);
        return { verb: "transform", from: from ?? "", to: to ?? "", animation };
      }
      case "clear": {
        const first = tokens[0] ?? "";
        const isTransition =
          first === "slide" || first === "instant" || first === "fade";
        const transition = isTransition ? first : "fade";
        const animTokens = isTransition ? tokens.slice(1) : tokens;
        const animation = parseAnimationTokens(animTokens);
        return { verb: "clear", transition, animation };
      }
      case "focus":
        return { verb: "focus", target: args };
      case "pulse":
        return { verb: "pulse", target: args };
      case "trace":
        return { verb: "trace", target: args };
      case "annotate": {
        const annoMatch = args.match(/^(\S+)\s+"(.+)"$/);
        if (annoMatch) {
          return {
            verb: "annotate",
            target: annoMatch[1] ?? "",
            text: annoMatch[2] ?? "",
          };
        }
        return { verb: "annotate", target: args, text: "" };
      }
      case "zoom": {
        const zoomMatch = args.match(/^(?:(\S+)\s+)?(\d+(?:\.\d+)?)x$/);
        if (zoomMatch) {
          return {
            verb: "zoom",
            target: zoomMatch[1] ?? "",
            scale: Number(zoomMatch[2]),
          };
        }
        return { verb: "zoom", target: "", scale: 1 };
      }
      case "flow":
        return { verb: "flow", target: args };
    }
  }

  // Bare keywords without args
  if (trimmed === "clear")
    return { verb: "clear", transition: "fade", animation: DEFAULT_ANIMATION };
  if (trimmed === "split") return { verb: "split" };
  if (trimmed === "unsplit") return { verb: "unsplit" };

  // Bare keyword check (no colon, but is a verb)
  const firstWord = trimmed.split(/\s+/)[0] ?? "";
  if (VERB_KEYWORDS.has(firstWord)) {
    return { verb: "advance" };
  }

  return { verb: "advance" };
}

// --- Narration parsing ---

function parseNarrationBlock(node: MdastNode): NarrationBlock {
  return parseNarrationFromText(extractText(node));
}

function parseNarrationFromText(rawText: string): NarrationBlock {
  const triggers: Trigger[] = [];
  let cleanText = "";
  let wordIndex = 0;

  // Trigger syntax: {{verb: args}} or {{bare text}}
  const parts = rawText.split(/(\{\{.*?\}\})/);
  for (const part of parts) {
    const triggerMatch = part.match(/^\{\{(.+?)\}\}$/);
    if (triggerMatch) {
      const triggerText = triggerMatch[1] ?? "";
      const action = parseTriggerAction(triggerText);
      triggers.push({ wordIndex, text: triggerText, action });
      // Only advance triggers contribute text to narration — verb triggers are silent commands
      if (action.verb === "advance") {
        cleanText += triggerText;
        wordIndex += triggerText.split(/\s+/).filter(Boolean).length;
      }
    } else {
      cleanText += part;
      wordIndex += part.split(/\s+/).filter(Boolean).length;
    }
  }

  return { text: cleanText.replace(/\s+/g, " ").trim(), triggers };
}

function splitAnimationTokens(tokens: readonly string[]): {
  readonly headTokens: readonly string[];
  readonly animTokens: readonly string[];
} {
  let splitIdx = tokens.length;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (isAnimationToken(tokens[i] ?? "")) {
      splitIdx = i;
      continue;
    }
    break;
  }
  return {
    headTokens: tokens.slice(0, splitIdx),
    animTokens: tokens.slice(splitIdx),
  };
}

function parseTargetList(tokens: readonly string[]): readonly string[] {
  const joined = tokens.join(" ");
  return joined
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

// --- Diagnostics ---

function validateStep(
  step: LessonStep,
  narration: readonly NarrationBlock[],
  blocks: ReadonlyMap<string, VisualizationState>,
): readonly LessonDiagnostic[] {
  const diagnostics: LessonDiagnostic[] = [];
  const blockNames = new Set(blocks.keys());
  const regionNames = new Set(
    [...blocks.values()].flatMap((b) => b.regions.map((r) => r.name)),
  );

  const stepLocation: DiagnosticLocation = {
    kind: "step",
    stepId: step.id,
    stepTitle: step.title,
  };

  narration.forEach((block, paragraphIndex) => {
    const hasVerb = block.triggers.some((t) => t.action.verb !== "advance");
    if (!hasVerb) {
      diagnostics.push({
        severity: "warning",
        message: "Narration paragraph has no visual triggers.",
        location: {
          kind: "paragraph",
          stepId: step.id,
          stepTitle: step.title,
          paragraphIndex,
        },
      });
    }

    block.triggers.forEach((trigger, triggerIndex) => {
      const location: DiagnosticLocation = {
        kind: "trigger",
        stepId: step.id,
        stepTitle: step.title,
        paragraphIndex,
        triggerIndex,
      };

      switch (trigger.action.verb) {
        case "show":
        case "hide": {
          if (!blockNames.has(trigger.action.target)) {
            diagnostics.push({
              severity: "warning",
              message: `Unknown block target: "${trigger.action.target}".`,
              location,
            });
          }
          return;
        }
        case "show-group":
        case "hide-group": {
          if (trigger.action.targets.length === 0) {
            diagnostics.push({
              severity: "warning",
              message: "Group trigger has no targets.",
              location,
            });
            return;
          }
          for (const target of trigger.action.targets) {
            if (!blockNames.has(target)) {
              diagnostics.push({
                severity: "warning",
                message: `Unknown block target: "${target}".`,
                location,
              });
            }
          }
          return;
        }
        case "transform": {
          if (!blockNames.has(trigger.action.from)) {
            diagnostics.push({
              severity: "warning",
              message: `Unknown transform source: "${trigger.action.from}".`,
              location,
            });
          }
          if (!blockNames.has(trigger.action.to)) {
            diagnostics.push({
              severity: "warning",
              message: `Unknown transform target: "${trigger.action.to}".`,
              location,
            });
          }
          if (blockNames.has(trigger.action.from) && blockNames.has(trigger.action.to)) {
            const from = blocks.get(trigger.action.from);
            const to = blocks.get(trigger.action.to);
            if (from && to && from.kind !== to.kind) {
              diagnostics.push({
                severity: "warning",
                message: `Transform crosses block kinds (${from.kind} -> ${to.kind}).`,
                location,
              });
            }
          }
          return;
        }
        case "zoom": {
          const target = trigger.action.target;
          if (target.length > 0 && !blockNames.has(target)) {
            diagnostics.push({
              severity: "warning",
              message: `Unknown zoom target: "${target}".`,
              location,
            });
          }
          return;
        }
        case "focus":
        case "annotate":
        case "flow":
        case "pulse":
        case "trace": {
          const target = trigger.action.target;
          if (target.length > 0 && target !== "none" && !regionNames.has(target)) {
            diagnostics.push({
              severity: "warning",
              message: `Unknown region: "${target}".`,
              location,
            });
          }
          return;
        }
        case "clear":
        case "split":
        case "unsplit":
        case "advance":
          return;
      }
    });
  });

  if (narration.length === 0 && blocks.size > 0) {
    diagnostics.push({
      severity: "warning",
      message: "Step has visuals but no narration.",
      location: stepLocation,
    });
  }

  return diagnostics;
}

// --- Code fence parsing ---

const FOCUS_RE = /\[focus\s+(\d+)(?:-(\d+))?\]/;

const VALID_GRAPH_LAYOUTS = new Set([
  "ring",
  "force",
  "tree",
  "grid",
  "bipartite",
]);

function parseCodeFence(
  node: MdastNode,
  kindCounters: Map<string, number>,
): VisualizationState | null {
  const rawLang = node.lang ?? "";
  const meta = node.meta ?? "";
  const value = node.value ?? "";

  const { blockKind, name: explicitName, params } = parseBlockMeta(rawLang, meta);

  // data — legacy: `data array` → lang="data", meta="array"
  // new: `data:buckets type=array` → blockKind="data", name="buckets"
  if (blockKind === "data") {
    const dataType =
      params.get("type") ?? meta.split(/\s+/)[0] ?? "linked-list";
    const layoutParam = params.get("layout") ?? "ring";
    const layout = VALID_GRAPH_LAYOUTS.has(layoutParam)
      ? (layoutParam as GraphLayoutKind)
      : "ring";
    const name = autoName("data", explicitName, kindCounters);
    return parseData(value, dataType, name, layout);
  }

  // diagram
  if (blockKind === "diagram") {
    const name = autoName("diagram", explicitName, kindCounters);
    return parseDiagram(value, name);
  }

  // math
  if (blockKind === "math") {
    const name = autoName("math", explicitName, kindCounters);
    return parseMath(value, name);
  }

  // chart
  if (blockKind === "chart") {
    const chartKind = params.get("type") ?? "bar";
    const name = autoName("chart", explicitName, kindCounters);
    return parseChart(value, name, chartKind);
  }

  // preview
  if (blockKind === "preview") {
    const template = (params.get("template") ?? "html") as PreviewTemplate;
    const name = autoName("preview", explicitName, kindCounters);
    return parsePreview(value, name, template);
  }

  // Otherwise: code
  const lang = blockKind || "text";
  const legacyFileName =
    params.get("lang") !== undefined
      ? ""
      : meta
          .split(/\s+/)
          .find((p) => !p.startsWith("[") && !p.includes("=")) ?? "";
  const langFromParams = params.get("lang") ?? lang;

  const focus: FocusRange[] = [];
  const focusMatch = meta.match(FOCUS_RE);
  if (focusMatch) {
    const start = Number(focusMatch[1]);
    const end = focusMatch[2] ? Number(focusMatch[2]) : start;
    focus.push({ start, end });
  }

  const { content: rawContent, regions } = splitContentAndRegions(value);

  const annotations: CodeAnnotation[] = [];
  const lines = rawContent.split("\n");
  const cleanLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line && line !== "") continue;
    const annoMatch = line.match(/^(.*?)\/\/ !(.*)$/);
    if (annoMatch) {
      cleanLines.push(annoMatch[1]?.trimEnd() ?? "");
      const annoText = annoMatch[2]?.trim() ?? "";
      if (annoText) {
        annotations.push({ line: i + 1, text: annoText });
      }
    } else {
      cleanLines.push(line);
    }
  }

  const content = cleanLines.join("\n");
  const name = autoName("code", explicitName, kindCounters);

  const codeState: CodeState = {
    kind: "code",
    name,
    lang: langFromParams,
    fileName: legacyFileName,
    content,
    focus,
    annotations,
    regions,
  };

  return codeState;
}

// --- Text extraction ---

function extractText(node: MdastNode): string {
  if (node.value) return node.value;
  if (!node.children) return "";
  return node.children.map(extractText).join("");
}
