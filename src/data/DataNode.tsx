import { motion } from "motion/react";
import type { PositionedNode } from "./layout-types";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DataNodeProps = {
  readonly node: PositionedNode;
  readonly dimmed?: boolean;
};

export function DataNode({
  node,
  dimmed = false,
}: DataNodeProps) {
  const isNull = node.id === "__null__";
  const isCircle = node.shape === "circle";
  const strokeColor = dimmed ? colors.textDim : colors.accent;
  const nodeOpacity = dimmed ? 0.4 : 1;

  return (
    <motion.g
      animate={{ x: node.x, y: node.y, opacity: nodeOpacity }}
      initial={{ x: node.x, y: node.y, opacity: 0 }}
      transition={{ x: spring, y: spring, opacity: fade }}
      {...(!dimmed ? { "data-focused": true } : {})}
    >
      {isCircle ? (
        <circle
          cx={node.width / 2}
          cy={node.height / 2}
          r={node.width / 2}
          fill={colors.codeBackground}
          stroke={strokeColor}
          strokeWidth={1.5}
        />
      ) : (
        <rect
          width={node.width}
          height={node.height}
          rx={Number.parseFloat(radii.md)}
          fill={isNull ? "none" : colors.codeBackground}
          stroke={isNull ? colors.textDim : strokeColor}
          strokeWidth={isNull ? 1 : 1.5}
          strokeDasharray={isNull ? "4 3" : "none"}
        />
      )}
      <text
        x={node.width / 2}
        y={node.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={isNull ? colors.textDim : colors.text}
        fontFamily={fonts.code}
        fontSize={isNull ? fontSizes.codeSmall : fontSizes.code}
      >
        {node.value}
      </text>
    </motion.g>
  );
}
