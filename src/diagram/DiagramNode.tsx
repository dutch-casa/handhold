import { motion } from "motion/react";
import type { PositionedDiagramNode } from "./layout";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DiagramNodeProps = {
  readonly node: PositionedDiagramNode;
  readonly dimmed?: boolean;
};

type NodeStyle = {
  readonly stroke: string;
  readonly strokeDasharray: string;
  readonly rx: number;
};

const NODE_STYLES = {
  service: {
    stroke: colors.accent,
    strokeDasharray: "none",
    rx: Number.parseFloat(radii.md),
  },
  database: {
    stroke: colors.success,
    strokeDasharray: "none",
    rx: 2,
  },
  cache: {
    stroke: colors.warning,
    strokeDasharray: "6 3",
    rx: Number.parseFloat(radii.md),
  },
  queue: {
    stroke: colors.error,
    strokeDasharray: "none",
    rx: Number.parseFloat(radii.lg),
  },
  client: {
    stroke: colors.text,
    strokeDasharray: "none",
    rx: 2,
  },
} as const satisfies Record<string, NodeStyle>;

function styleFor(nodeType: string): NodeStyle {
  return (
    (NODE_STYLES as Record<string, NodeStyle>)[nodeType] ??
    NODE_STYLES.service
  );
}

export function DiagramNode({
  node,
  dimmed = false,
}: DiagramNodeProps) {
  const style = styleFor(node.nodeType);
  const strokeColor = dimmed ? colors.textDim : style.stroke;
  const nodeOpacity = dimmed ? 0.4 : 1;

  return (
    <motion.g
      animate={{ x: node.x, y: node.y, opacity: nodeOpacity }}
      initial={{ x: node.x, y: node.y, opacity: 0 }}
      transition={{ x: spring, y: spring, opacity: fade }}
      {...(!dimmed ? { "data-focused": true } : {})}
    >
      <rect
        width={node.width}
        height={node.height}
        rx={style.rx}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeDasharray={style.strokeDasharray}
      />
      <circle
        cx={node.width - 12}
        cy={12}
        r={4}
        fill={strokeColor}
      />
      <text
        x={node.width / 2}
        y={node.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={colors.text}
        fontFamily={fonts.ui}
        fontSize={fontSizes.codeSmall}
        fontWeight={500}
      >
        {node.label}
      </text>
    </motion.g>
  );
}
