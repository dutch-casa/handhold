import { motion } from "motion/react";
import type { PositionedPointer } from "./layout-types";
import { colors, fonts, fontSizes, spring, fade } from "@/app/theme";

type DataPointerProps = {
  readonly pointer: PositionedPointer;
};

export function DataPointer({ pointer }: DataPointerProps) {
  return (
    <motion.g
      animate={{ x: pointer.x, y: pointer.y - 20, opacity: 1 }}
      initial={{ x: pointer.x, y: pointer.y - 12, opacity: 0 }}
      transition={{ x: spring, y: spring, opacity: fade }}
    >
      {/* Arrow line pointing up */}
      <line x1={0} y1={20} x2={0} y2={4} stroke={colors.accent} strokeWidth={1.5} />
      {/* Arrowhead */}
      <polygon points="0,0 -4,6 4,6" fill={colors.accent} />
      {/* Label below the arrow */}
      <text
        x={0}
        y={32}
        textAnchor="middle"
        dominantBaseline="hanging"
        fill={colors.accent}
        fontFamily={fonts.code}
        fontSize={fontSizes.codeSmall}
      >
        {pointer.name}
      </text>
    </motion.g>
  );
}
