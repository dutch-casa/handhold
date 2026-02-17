import { motion } from "motion/react";
import type { PositionedDiagramGroup } from "./layout";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DiagramGroupProps = {
  readonly group: PositionedDiagramGroup;
};

export function DiagramGroup({ group }: DiagramGroupProps) {
  if (group.width === 0) return null;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fade}
    >
      <motion.rect
        animate={{ x: group.x, y: group.y, width: group.width, height: group.height }}
        transition={spring}
        rx={Number.parseFloat(radii.lg)}
        fill="none"
        stroke={colors.border}
        strokeWidth={1}
        strokeDasharray="4 3"
      />
      <motion.text
        animate={{ x: group.x + 8, y: group.y + 14 }}
        transition={spring}
        fill={colors.textDim}
        fontFamily={fonts.ui}
        fontSize={fontSizes.codeSmall}
      >
        {group.name}
      </motion.text>
    </motion.g>
  );
}
