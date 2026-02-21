import { motion } from "motion/react";
import type { PositionedEdge } from "./layout-types";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DataEdgeProps = {
  readonly edge: PositionedEdge;
  readonly flowing?: boolean;
  readonly tracing?: boolean;
  readonly drawing?: boolean;
  readonly exiting?: boolean;
  readonly prevEdge?: PositionedEdge | undefined;
};

const ARROW_SIZE = 6;
const LABEL_PAD_X = 4;
const LABEL_PAD_Y = 2;

const FLOW_STROKE_TRANSITION = {
  strokeDashoffset: { repeat: Infinity, duration: 0.8, ease: "linear" as const },
  stroke: fade,
  strokeWidth: fade,
};

const TRACE_STROKE_TRANSITION = {
  strokeDashoffset: { repeat: Infinity, duration: 0.6, ease: "linear" as const },
  stroke: fade,
  strokeWidth: fade,
};

const DRAW_TRANSITION = {
  pathLength: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  stroke: fade,
  strokeWidth: fade,
};

export function DataEdge({ edge, flowing = false, tracing = false, drawing = false, exiting = false, prevEdge }: DataEdgeProps) {
  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const ux = dx / len;
  const uy = dy / len;
  const endX = edge.x2 - ux * ARROW_SIZE;
  const endY = edge.y2 - uy * ARROW_SIZE;

  const perpX = -uy;
  const perpY = ux;
  const hw = ARROW_SIZE / 2;
  const baseX = endX - ux * ARROW_SIZE;
  const baseY = endY - uy * ARROW_SIZE;
  const arrowPts = `${endX},${endY} ${baseX + perpX * hw},${baseY + perpY * hw} ${baseX - perpX * hw},${baseY - perpY * hw}`;

  // Reverse arrowhead for bidirectional edges
  const startX = edge.x1 + ux * ARROW_SIZE;
  const startY = edge.y1 + uy * ARROW_SIZE;
  const revBaseX = startX + ux * ARROW_SIZE;
  const revBaseY = startY + uy * ARROW_SIZE;
  const revArrowPts = `${startX},${startY} ${revBaseX + perpX * hw},${revBaseY + perpY * hw} ${revBaseX - perpX * hw},${revBaseY - perpY * hw}`;

  const lineStart = edge.bidirectional ? { x1: startX, y1: startY } : { x1: edge.x1, y1: edge.y1 };
  const lineProps = { ...lineStart, x2: endX, y2: endY };

  // Use previous edge positions as initial for spring interpolation
  const prevLineProps = prevEdge
    ? (() => {
        const pdx = prevEdge.x2 - prevEdge.x1;
        const pdy = prevEdge.y2 - prevEdge.y1;
        const plen = Math.sqrt(pdx * pdx + pdy * pdy);
        if (plen === 0) return lineProps;
        const pux = pdx / plen;
        const puy = pdy / plen;
        const pEndX = prevEdge.x2 - pux * ARROW_SIZE;
        const pEndY = prevEdge.y2 - puy * ARROW_SIZE;
        return { x1: prevEdge.x1, y1: prevEdge.y1, x2: pEndX, y2: pEndY };
      })()
    : lineProps;

  const midX = (edge.x1 + edge.x2) / 2;
  const midY = (edge.y1 + edge.y2) / 2;

  const edgeLen = Math.sqrt((endX - edge.x1) ** 2 + (endY - edge.y1) ** 2);

  // Resolve style to stroke dash
  const styleDash = edge.style === "dashed" ? "6 4" : "none";

  if (drawing) {
    return (
      <motion.g
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={fade}
      >
        <motion.line
          {...lineProps}
          stroke={colors.accent}
          strokeWidth={2.2}
          strokeDasharray={edgeLen}
          initial={{ strokeDashoffset: edgeLen }}
          animate={{ strokeDashoffset: 0 }}
          transition={DRAW_TRANSITION.pathLength}
        />
        <motion.polygon
          initial={{ points: arrowPts, fill: colors.accent, opacity: 0, scale: 0 }}
          animate={{ points: arrowPts, fill: colors.accent, opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, ...fade }}
        />
        {edge.bidirectional && (
          <motion.polygon
            initial={{ points: revArrowPts, fill: colors.accent, opacity: 0, scale: 0 }}
            animate={{ points: revArrowPts, fill: colors.accent, opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, ...fade }}
          />
        )}
      </motion.g>
    );
  }

  const strokeColor = tracing
    ? colors.accent
    : flowing
      ? colors.secondary
      : colors.textMuted;
  const strokeWidth = tracing ? 2.2 : flowing ? 2 : 1.5;
  const dashArray = tracing ? "6 4" : flowing ? "8 4" : styleDash;
  const dashOffset = tracing ? [0, -24] : flowing ? [0, -20] : 0;
  const transition = tracing
    ? TRACE_STROKE_TRANSITION
    : flowing
      ? FLOW_STROKE_TRANSITION
      : spring;

  return (
    <motion.g
      initial={{ opacity: exiting ? 1 : 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={fade}
    >
      {/* Double-line effect for "double" style */}
      {edge.style === "double" && (
        <motion.line
          initial={prevLineProps}
          animate={{
            ...lineProps,
            stroke: colors.bg,
            strokeWidth: strokeWidth + 4,
          }}
          transition={spring}
        />
      )}
      <motion.line
        initial={prevLineProps}
        animate={{
          ...lineProps,
          stroke: strokeColor,
          strokeWidth,
          strokeDashoffset: dashOffset,
        }}
        transition={transition}
        strokeDasharray={dashArray}
      />
      <motion.polygon
        initial={{ points: arrowPts }}
        animate={{ points: arrowPts, fill: strokeColor }}
        transition={spring}
      />
      {edge.bidirectional && (
        <motion.polygon
          initial={{ points: revArrowPts }}
          animate={{ points: revArrowPts, fill: strokeColor }}
          transition={spring}
        />
      )}
      {edge.label && (
        <g>
          <rect
            x={midX - LABEL_PAD_X - edge.label.length * 3.5}
            y={midY - 8 - LABEL_PAD_Y}
            width={edge.label.length * 7 + LABEL_PAD_X * 2}
            height={16 + LABEL_PAD_Y * 2}
            rx={Number.parseFloat(radii.sm)}
            fill={colors.bg}
          />
          <text
            x={midX}
            y={midY}
            textAnchor="middle"
            dominantBaseline="central"
            fill={strokeColor}
            fontFamily={fonts.code}
            fontSize={fontSizes.codeSmall}
          >
            {edge.label}
          </text>
        </g>
      )}
    </motion.g>
  );
}
