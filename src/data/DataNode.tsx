import { motion } from "motion/react";
import type { PositionedNode } from "./layout-types";
import { colors, fonts, fontSizes, radii, spring, fade } from "@/app/theme";

type DataNodeProps = {
  readonly node: PositionedNode;
  readonly dimmed?: boolean | undefined;
  readonly pulsing?: boolean | undefined;
  readonly panTarget?: boolean | undefined;
  readonly initialX?: number | undefined;
  readonly initialY?: number | undefined;
  readonly exiting?: boolean | undefined;
  readonly prevValue?: string | undefined;
  readonly prevMarker?: PositionedNode["marker"] | undefined;
};

export function DataNode({
  node,
  dimmed = false,
  pulsing = false,
  panTarget = false,
  initialX,
  initialY,
  exiting = false,
  prevValue,
  prevMarker,
}: DataNodeProps) {
  const isNull = node.id === "__null__";
  const isCircle = node.shape === "circle";
  const isDiamond = node.shape === "diamond";
  const isGridCell = node.shape === "grid-cell";
  const strokeColor = resolveStrokeColor(node.marker, dimmed);
  const fillColor = resolveFillColor(node.marker, isNull);
  const nodeOpacity = exiting ? 0 : dimmed ? 0.4 : 1;
  const valueChanged = prevValue !== undefined && prevValue !== node.value;
  const markerChanged = prevMarker !== undefined && prevMarker !== node.marker;

  // Color transition for marker change (e.g. red-black recoloring)
  const prevStrokeColor = markerChanged ? resolveStrokeColor(prevMarker, false) : undefined;

  const useInitial = Number.isFinite(initialX) && Number.isFinite(initialY);
  const initialPos = {
    x: useInitial ? (initialX as number) : node.x,
    y: useInitial ? (initialY as number) : node.y,
    opacity: useInitial ? (exiting ? 1 : (dimmed ? 0.4 : 1)) : 0,
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
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{
        x: spring,
        y: spring,
        opacity: fade,
        scale: pulsing ? { duration: 0.6, ease: "easeOut" } : fade,
      }}
      {...(!dimmed ? { "data-focused": true } : {})}
      {...(panTarget ? { "data-pan-target": true } : {})}
    >
      {isDiamond ? (
        <motion.polygon
          points={`${node.width / 2},0 ${node.width},${node.height / 2} ${node.width / 2},${node.height} 0,${node.height / 2}`}
          fill={fillColor}
          {...(prevStrokeColor ? { initial: { stroke: prevStrokeColor } } : {})}
          animate={{ stroke: strokeColor }}
          transition={fade}
          strokeWidth={1.5}
        />
      ) : isCircle ? (
        <motion.circle
          cx={node.width / 2}
          cy={node.height / 2}
          r={node.width / 2}
          fill={fillColor}
          {...(prevStrokeColor ? { initial: { stroke: prevStrokeColor } } : {})}
          animate={{ stroke: strokeColor }}
          transition={fade}
          strokeWidth={1.5}
        />
      ) : (
        <motion.rect
          width={node.width}
          height={node.height}
          rx={isGridCell ? 0 : Number.parseFloat(radii.md)}
          fill={isNull ? "none" : fillColor}
          {...(prevStrokeColor ? { initial: { stroke: prevStrokeColor } } : {})}
          animate={{ stroke: isNull ? colors.textDim : strokeColor }}
          transition={fade}
          strokeWidth={isNull ? 1 : 1.5}
          strokeDasharray={isNull ? "4 3" : node.marker === "marked" ? "6 3" : "none"}
        />
      )}

      {/* Terminal marker: filled inner circle */}
      {node.marker === "terminal" && isCircle && (
        <circle
          cx={node.width / 2}
          cy={node.height / 2}
          r={node.width / 2 - 4}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
        />
      )}

      {/* Active/inactive bit markers */}
      {node.marker === "active-bit" && (
        <rect
          x={2}
          y={2}
          width={node.width - 4}
          height={node.height - 4}
          rx={2}
          fill={colors.accent}
          opacity={0.3}
        />
      )}

      {/* Red/black markers for red-black trees */}
      {(node.marker === "red" || node.marker === "black") && (
        <circle
          cx={node.width - 4}
          cy={4}
          r={4}
          fill={node.marker === "red" ? "#e05252" : "#555"}
        />
      )}

      {/* Value crossfade: animate old value out, new in */}
      {valueChanged && (
        <motion.text
          key={`prev-${prevValue}`}
          x={node.width / 2}
          y={node.secondaryValue ? node.height / 2 - 6 : node.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={colors.textDim}
          fontFamily={fonts.code}
          fontSize={fontSizes.code}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={fade}
        >
          {prevValue}
        </motion.text>
      )}
      <motion.text
        x={node.width / 2}
        y={node.secondaryValue ? node.height / 2 - 6 : node.height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={isNull ? colors.textDim : colors.text}
        fontFamily={fonts.code}
        fontSize={isNull ? fontSizes.codeSmall : fontSizes.code}
        {...(valueChanged ? { initial: { opacity: 0 } } : {})}
        animate={{ opacity: 1 }}
        transition={fade}
      >
        {node.value}
      </motion.text>

      {/* Secondary value: rendered below the main value */}
      {node.secondaryValue && (
        <text
          x={node.width / 2}
          y={node.height / 2 + 8}
          textAnchor="middle"
          dominantBaseline="central"
          fill={colors.textMuted}
          fontFamily={fonts.code}
          fontSize={fontSizes.codeSmall}
        >
          {node.secondaryValue}
        </text>
      )}
    </motion.g>
  );
}

function resolveStrokeColor(marker: PositionedNode["marker"], dimmed: boolean): string {
  if (dimmed) return colors.textDim;
  if (marker === "red") return "#e05252";
  if (marker === "black") return "#555";
  if (marker === "active-bit") return colors.accent;
  if (marker === "bucket-header") return colors.secondary;
  return colors.accent;
}

function resolveFillColor(marker: PositionedNode["marker"], isNull: boolean): string {
  if (isNull) return "none";
  if (marker === "inactive-bit") return colors.bg;
  return colors.codeBackground;
}
