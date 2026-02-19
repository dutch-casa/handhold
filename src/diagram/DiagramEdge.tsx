import { motion } from "motion/react";
import type { PositionedDiagramEdge } from "./layout";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DiagramEdgeProps = {
  readonly edge: PositionedDiagramEdge;
  readonly flowing?: boolean;
  readonly tracing?: boolean;
};

const ARROW_SIZE = 8;
const LABEL_PAD_X = 6;
const LABEL_PAD_Y = 3;

const FLOW_PATH_TRANSITION = {
  strokeDashoffset: { repeat: Infinity, duration: 0.8, ease: "linear" as const },
  stroke: fade,
  strokeWidth: fade,
};

const TRACE_PATH_TRANSITION = {
  strokeDashoffset: { repeat: Infinity, duration: 0.6, ease: "linear" as const },
  stroke: fade,
  strokeWidth: fade,
};

export function DiagramEdge({ edge, flowing = false, tracing = false }: DiagramEdgeProps) {
  const perpX = -edge.endDirY;
  const perpY = edge.endDirX;
  const hw = ARROW_SIZE / 2;
  const baseX = edge.endX - edge.endDirX * ARROW_SIZE;
  const baseY = edge.endY - edge.endDirY * ARROW_SIZE;
  const arrowPts = `${edge.endX},${edge.endY} ${baseX + perpX * hw},${baseY + perpY * hw} ${baseX - perpX * hw},${baseY - perpY * hw}`;

  const strokeColor = tracing
    ? colors.accent
    : flowing
      ? colors.secondary
      : colors.textMuted;
  const strokeWidth = tracing ? 2.2 : flowing ? 2 : 1.5;
  const dashArray = tracing ? "6 4" : flowing ? "8 4" : "none";
  const dashOffset = tracing ? [0, -24] : flowing ? [0, -20] : 0;
  const pathTransition = tracing
    ? TRACE_PATH_TRANSITION
    : flowing
      ? FLOW_PATH_TRANSITION
      : spring;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fade}
    >
      <motion.path
        initial={{ d: edge.pathData }}
        animate={{
          d: edge.pathData,
          stroke: strokeColor,
          strokeWidth,
          strokeDashoffset: dashOffset,
        }}
        transition={pathTransition}
        fill="none"
        strokeDasharray={dashArray}
      />
      <motion.polygon
        initial={{ points: arrowPts }}
        animate={{ points: arrowPts, fill: strokeColor }}
        transition={spring}
      />
      {edge.label && (
        <g>
          <rect
            x={edge.labelX - LABEL_PAD_X - edge.label.length * 3.5}
            y={edge.labelY - 8 - LABEL_PAD_Y}
            width={edge.label.length * 7 + LABEL_PAD_X * 2}
            height={16 + LABEL_PAD_Y * 2}
            rx={Number.parseFloat(radii.sm)}
            fill={colors.bg}
          />
          <text
            x={edge.labelX}
            y={edge.labelY}
            textAnchor="middle"
            dominantBaseline="central"
            fill={strokeColor}
            fontFamily={fonts.ui}
            fontSize={fontSizes.codeSmall}
          >
            {edge.label}
          </text>
        </g>
      )}
    </motion.g>
  );
}
