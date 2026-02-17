import { motion } from "motion/react";
import type { PositionedEdge } from "./layout-types";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DataEdgeProps = {
  readonly edge: PositionedEdge;
  readonly flowing?: boolean;
};

const ARROW_SIZE = 6;
const LABEL_PAD_X = 4;
const LABEL_PAD_Y = 2;

const FLOW_STROKE_TRANSITION = {
  strokeDashoffset: { repeat: Infinity, duration: 0.8, ease: "linear" as const },
  stroke: fade,
  strokeWidth: fade,
};

export function DataEdge({ edge, flowing = false }: DataEdgeProps) {
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

  const lineProps = { x1: edge.x1, y1: edge.y1, x2: endX, y2: endY };

  const midX = (edge.x1 + edge.x2) / 2;
  const midY = (edge.y1 + edge.y2) / 2;

  const strokeColor = flowing ? colors.secondary : colors.textMuted;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fade}
    >
      <motion.line
        initial={lineProps}
        animate={{
          ...lineProps,
          stroke: strokeColor,
          strokeWidth: flowing ? 2 : 1.5,
          strokeDashoffset: flowing ? [0, -20] : 0,
        }}
        transition={flowing ? FLOW_STROKE_TRANSITION : spring}
        strokeDasharray={flowing ? "8 4" : "none"}
      />
      <motion.polygon
        initial={{ points: arrowPts }}
        animate={{ points: arrowPts, fill: strokeColor }}
        transition={spring}
      />
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
            fill={flowing ? colors.secondary : colors.textMuted}
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
