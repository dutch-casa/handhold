import type {
  DiagramState,
  DiagramNodeDef,
  DiagramNodeType,
  DiagramEdgeDef,
  DiagramGroupDef,
} from "@/types/lesson";
import { splitContentAndRegions } from "./parse-regions";

// Parse the diagram mini-language.
// Pure function: string → DiagramState.

const NODE_RE = /^(\w+)\s+\[(\w+)\]$/;
const LABELED_EDGE_RE = /^(\w+)\s+--(.+?)-->\s+(\w+)$/;
const EDGE_RE = /^(\w+)\s+-->\s+(\w+)$/;
const GROUP_RE = /^\{(.+?):\s*(.+)\}$/;

const VALID_TYPES = new Set<DiagramNodeType>([
  "client",
  "service",
  "database",
  "cache",
  "queue",
  "load-balancer",
  "api-gateway",
  "message-queue",
  "user",
  "server",
]);

function asNodeType(s: string): DiagramNodeType {
  if (VALID_TYPES.has(s as DiagramNodeType)) return s as DiagramNodeType;
  return "service";
}

export function parseDiagram(
  text: string,
  name: string = "diagram-0",
): DiagramState {
  const { content, regions } = splitContentAndRegions(text);

  const nodes: DiagramNodeDef[] = [];
  const edges: DiagramEdgeDef[] = [];
  const groups: DiagramGroupDef[] = [];

  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const groupMatch = line.match(GROUP_RE);
    if (groupMatch) {
      const gName = groupMatch[1];
      const members = groupMatch[2];
      if (gName && members) {
        groups.push({
          name: gName.trim(),
          memberIds: members.split(",").map((s) => s.trim()),
        });
      }
      continue;
    }

    const labeledMatch = line.match(LABELED_EDGE_RE);
    if (labeledMatch) {
      const from = labeledMatch[1];
      const label = labeledMatch[2];
      const to = labeledMatch[3];
      if (from && to) {
        edges.push({ fromId: from, toId: to, label: label?.trim() ?? "" });
      }
      continue;
    }

    const edgeMatch = line.match(EDGE_RE);
    if (edgeMatch) {
      const from = edgeMatch[1];
      const to = edgeMatch[2];
      if (from && to) {
        edges.push({ fromId: from, toId: to, label: "" });
      }
      continue;
    }

    const nodeMatch = line.match(NODE_RE);
    if (nodeMatch) {
      const id = nodeMatch[1];
      const type = nodeMatch[2];
      if (id && type) {
        nodes.push({ id, label: id, nodeType: asNodeType(type) });
      }
      continue;
    }
  }

  return { kind: "diagram", name, nodes, edges, groups, regions };
}
