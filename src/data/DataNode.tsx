import { motion } from "motion/react";
import type { PositionedNode } from "./layout-types";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DataNodeProps = {
  readonly node: PositionedNode;
  readonly dimmed?: boolean;
  readonly pulsing?: boolean;
  readonly initialX?: number;
  readonly initialY?: number;
};

export function DataNode({
  node,
  dimmed = false,
  pulsing = false,
  initialX,
  initialY,
}: DataNodeProps) {
  const isNull = node.id === "__null__";
  const isCircle = node.shape === "circle";
  const strokeColor = dimmed ? colors.textDim : colors.accent;
  const nodeOpacity = dimmed ? 0.4 : 1;

  const useInitial = Number.isFinite(initialX) && Number.isFinite(initialY);
  const initialPos = {
    x: useInitial ? (initialX as number) : node.x,
    y: useInitial ? (initialY as number) : node.y,
    opacity: useInitial ? nodeOpacity : 0,
  };

  return (
    <motion.g
      animate={{
        x: node.x,
        y: node.y,
        opacity: nodeOpacity,
        scale: pulsing ? [1, 1.08, 1] : 1,
      }}
      initial={initialPos}
      transition={{
        x: spring,
        y: spring,
        opacity: fade,
        scale: pulsing ? { duration: 0.6, ease: "easeOut" } : fade,
      }}
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
