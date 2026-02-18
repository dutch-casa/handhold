import { motion } from "motion/react";
import type { PositionedDiagramGroup } from "./layout";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DiagramGroupProps = {
  readonly group: PositionedDiagramGroup;
};

export function DiagramGroupBoundary({ group }: DiagramGroupProps) {
  if (group.width === 0 || !Number.isFinite(group.width) || !Number.isFinite(group.height)) {
    return null;
  }

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
    </motion.g>
  );
}

export function DiagramGroupLabel({ group }: DiagramGroupProps) {
  if (group.width === 0 || !Number.isFinite(group.width) || !Number.isFinite(group.height)) {
    return null;
  }

  const fontSize = Number.parseFloat(fontSizes.codeSmall);
  const padX = 8;
  const padY = 4;
  const labelWidth = group.name.length * fontSize * 0.55 + padX * 2;
  const labelHeight = fontSize + padY * 2;
  const labelX = group.x + 8;
  const labelY = group.y + 6;

  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={fade}
    >
      <motion.rect
        animate={{ x: labelX, y: labelY, width: labelWidth, height: labelHeight }}
        transition={spring}
        rx={Number.parseFloat(radii.sm)}
        fill={colors.bg}
        opacity={0.75}
      />
      <motion.text
        animate={{ x: labelX + padX, y: labelY + labelHeight - padY }}
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
