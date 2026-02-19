import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import type { DiagramState, SceneAnnotation } from "@/types/lesson";
import type { DiagramLayout } from "./layout";
import { layoutDiagramWithElk } from "./elk-layout";
import { DiagramNode } from "./DiagramNode";
import { DiagramEdge } from "./DiagramEdge";
import { DiagramGroupBoundary, DiagramGroupLabel } from "./DiagramGroup";
import { colors, fonts, fade } from "@/app/theme";

type DiagramProps = {
  readonly state: DiagramState;
  readonly prevState: DiagramState | undefined;
  readonly focus: string;
  readonly flow: string;
  readonly pulse: string;
  readonly trace: string;
  readonly annotations: readonly SceneAnnotation[];
};

export function Diagram({ state, prevState, focus, flow, pulse, trace, annotations }: DiagramProps) {
  const { data: layout } = useQuery<DiagramLayout>({
    queryKey: ["elk-layout", state],
    queryFn: () => layoutDiagramWithElk(state),
    staleTime: Infinity,
    enabled: state.nodes.length > 0,
  });
  const { data: prevLayout } = useQuery<DiagramLayout>({
    queryKey: ["elk-layout", "prev", prevState],
    queryFn: () => {
      if (!prevState) {
        throw new Error("prevState missing for diagram layout");
      }
      return layoutDiagramWithElk(prevState);
    },
    staleTime: Infinity,
    enabled: !!prevState && prevState.nodes.length > 0,
  });

  const focusedIds = resolveDiagramRegion(focus, state);
  const pulsedIds = resolveDiagramRegion(pulse, state);

  const flowingEdgeIds = useMemo(
    () => resolveFlowEdges(flow, state),
    [flow, state],
  );

  const tracedEdgeIds = useMemo(
    () => resolveFlowEdges(trace, state),
    [trace, state],
  );

  const dedupedAnnotations = useMemo(() => {
    const byTarget = new Map<string, SceneAnnotation>();
    for (const anno of annotations) {
      byTarget.set(anno.target, anno);
    }
    return [...byTarget.values()];
  }, [annotations]);

  const orderedEdges = useMemo(() => {
    const edges = layout?.edges ?? [];
    const edgePriority = (edge: DiagramLayout["edges"][number]) => {
      const keyA = `${edge.fromId}->${edge.toId}`;
      const keyB = `${edge.toId}->${edge.fromId}`;
      if (tracedEdgeIds.has(keyA) || tracedEdgeIds.has(keyB)) return 2;
      if (flowingEdgeIds.has(keyA) || flowingEdgeIds.has(keyB)) return 1;
      return 0;
    };
    return [...edges].sort((a, b) => edgePriority(a) - edgePriority(b));
  }, [layout?.edges, tracedEdgeIds, flowingEdgeIds]);

  if (!layout || layout.width === 0) return null;

  const prevNodeMap = new Map(
    (prevLayout?.nodes ?? []).map((n) => [n.id, n]),
  );

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      style={svgStyle}
    >
      {layout.groups.map((group) => (
        <DiagramGroupBoundary key={`boundary-${group.name}`} group={group} />
      ))}
      {orderedEdges.map((edge) => (
        <DiagramEdge
          key={edge.id}
          edge={edge}
          flowing={flowingEdgeIds.has(`${edge.fromId}->${edge.toId}`) || flowingEdgeIds.has(`${edge.toId}->${edge.fromId}`)}
          tracing={tracedEdgeIds.has(`${edge.fromId}->${edge.toId}`) || tracedEdgeIds.has(`${edge.toId}->${edge.fromId}`)}
        />
      ))}
      {layout.nodes.map((node) => (
        <DiagramNode
          key={node.id}
          node={node}
          dimmed={focusedIds.length > 0 && !focusedIds.includes(node.id)}
          pulsing={pulsedIds.includes(node.id)}
          initialX={prevNodeMap.get(node.id)?.x}
          initialY={prevNodeMap.get(node.id)?.y}
        />
      ))}
      {layout.groups.map((group) => (
        <DiagramGroupLabel key={`label-${group.name}`} group={group} />
      ))}
      {dedupedAnnotations.map((anno) => {
        const nodeId = resolveDiagramRegion(anno.target, state)[0];
        if (!nodeId) return null;
        const node = layout.nodes.find((n) => n.id === nodeId);
        if (!node) return null;
        return (
          <motion.g
            key={`anno-${anno.target}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={fade}
          >
            <text
              x={node.x + node.width / 2}
              y={node.y - 10}
              textAnchor="middle"
              fill={colors.accent}
              fontSize="12"
              fontFamily={fonts.ui}
              stroke={colors.bg}
              strokeWidth={4}
              paintOrder="stroke"
            >
              {anno.text}
            </text>
          </motion.g>
        );
      })}
    </svg>
  );
}

const svgStyle: React.CSSProperties = {
  maxWidth: "100%",
  height: "auto",
  display: "block",
};

function resolveDiagramRegion(
  regionName: string,
  state: DiagramState,
): string[] {
  if (regionName.length === 0) return [];
  const ids: string[] = [];
  for (const r of state.regions) {
    if (r.name !== regionName) continue;
    for (const segment of r.target.split(",")) {
      ids.push(segment.trim());
    }
  }
  return ids;
}

function resolveFlowEdges(flowRegion: string, state: DiagramState): Set<string> {
  const edgeIds = new Set<string>();
  if (flowRegion.length === 0) return edgeIds;

  const nodeIds = resolveDiagramRegion(flowRegion, state);
  if (nodeIds.length < 2) return edgeIds;

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const from = nodeIds[i];
    const to = nodeIds[i + 1];
    if (from && to) {
      edgeIds.add(`${from}->${to}`);
      edgeIds.add(`${to}->${from}`);
    }
  }
  return edgeIds;
}
