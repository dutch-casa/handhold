import { motion } from "motion/react";
import type { PositionedPointer } from "./layout-types";
import { colors, fonts, fontSizes, spring, fade } from "@/app/theme";

type DataPointerProps = {
  readonly pointer: PositionedPointer;
};

const ARROW_LEN = 20;
const LABEL_OFFSET = 18;

export function DataPointer({ pointer }: DataPointerProps) {
  const deg = pointer.angle ?? 0;
  const hasRotation = deg !== 0;
  const rad = (deg * Math.PI) / 180;

  // Label offset: opposite the arrow direction (away from what the arrow points at)
  const lx = hasRotation ? -Math.sin(rad) * LABEL_OFFSET : 0;
  const ly = hasRotation ? Math.cos(rad) * LABEL_OFFSET : LABEL_OFFSET;

  return (
    <motion.g
      animate={{ x: pointer.x, y: pointer.y, opacity: 1 }}
      initial={{ x: pointer.x, y: pointer.y, opacity: 0 }}
      transition={{ x: spring, y: spring, opacity: fade }}
    >
      <g transform={hasRotation ? `rotate(${deg})` : undefined}>
        <line x1={0} y1={0} x2={0} y2={-16} stroke={colors.accent} strokeWidth={1.5} />
        <polygon points={`0,${-ARROW_LEN} -4,${-ARROW_LEN + 6} 4,${-ARROW_LEN + 6}`} fill={colors.accent} />
      </g>
      <text
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline={ly < -2 ? "auto" : ly > 2 ? "hanging" : "central"}
        fill={colors.accent}
        fontFamily={fonts.code}
        fontSize={fontSizes.codeSmall}
      >
        {pointer.name}
      </text>
    </motion.g>
  );
}
