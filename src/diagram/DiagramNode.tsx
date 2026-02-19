import { Cpu, Database, Inbox, Layers, Monitor, Server, User } from "lucide-react";
import { motion } from "motion/react";
import type { PositionedDiagramNode } from "./layout";
import { defaultAwsIconKey, resolveAwsIconComponent } from "./aws-icon-registry";
import { resolveTechIconComponent } from "./tech-icon-registry";
import { colors, fonts, fontSizes, spring, fade } from "@/app/theme";

type DiagramNodeProps = {
  readonly node: PositionedDiagramNode;
  readonly dimmed?: boolean | undefined;
  readonly pulsing?: boolean | undefined;
  readonly panTarget?: boolean | undefined;
  readonly initialX?: number | undefined;
  readonly initialY?: number | undefined;
};

const defaultIconKey = defaultAwsIconKey;
const LABEL_GAP = 10;
const ICON_PADDING = 6;

export function DiagramNode({
  node,
  dimmed = false,
  pulsing = false,
  panTarget = false,
  initialX,
  initialY,
}: DiagramNodeProps) {
  if (!Number.isFinite(node.width) || !Number.isFinite(node.height)) {
    return null;
  }

  const nodeOpacity = dimmed ? 0.4 : 1;
  const iconKey = node.icon ?? defaultIconKey(node.nodeType);
  const AwsIcon = iconKey ? resolveAwsIconComponent(iconKey) : null;
  const TechIcon = !AwsIcon && iconKey ? resolveTechIconComponent(iconKey) : null;
  const LucideIcon = !AwsIcon && !TechIcon ? lucideIconFor(node.nodeType) : null;
  const hasIcon = AwsIcon !== null || TechIcon !== null || LucideIcon !== null;

  if (!hasIcon) {
    return null;
  }

  const iconSize = Math.max(
    16,
    Math.min(node.width, node.height) - ICON_PADDING * 2,
  );
  const iconX = (node.width - iconSize) / 2;
  const iconY = (node.height - iconSize) / 2;
  const labelX = node.width / 2;
  const labelY =
    node.height + LABEL_GAP + Number.parseFloat(fontSizes.codeSmall) / 2;

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
      {...(panTarget ? { "data-pan-target": true } : {})}
    >
      {AwsIcon ? (
        <AwsIcon
          size={iconSize}
          x={iconX}
          y={iconY}
          className={awsIconClassName(node.nodeType, iconKey)}
        />
      ) : TechIcon ? (
        <TechIcon
          x={iconX}
          y={iconY}
          width={iconSize}
          height={iconSize}
          color={colors.text}
        />
      ) : LucideIcon ? (
        <LucideIcon
          x={iconX}
          y={iconY}
          width={iconSize}
          height={iconSize}
          color={iconColorFor(node.nodeType, dimmed)}
          strokeWidth={1.6}
        />
      ) : null}
      <text
        x={labelX}
        y={labelY}
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

function lucideIconFor(nodeType: string) {
  switch (nodeType) {
    case "service":
      return Cpu;
    case "client":
      return Monitor;
    case "user":
      return User;
    case "server":
      return Server;
    case "database":
      return Database;
    case "cache":
      return Layers;
    case "queue":
    case "message-queue":
      return Inbox;
    default:
      return null;
  }
}

function iconColorFor(nodeType: string, dimmed: boolean): string {
  const base =
    nodeType === "database"
      ? colors.success
      : nodeType === "cache"
        ? colors.warning
        : nodeType === "queue" || nodeType === "message-queue"
          ? colors.error
          : nodeType === "client" || nodeType === "user"
            ? colors.text
            : colors.accent;
  return dimmed ? colors.textDim : base;
}

function awsIconClassName(nodeType: string, iconKey: string | null): string | undefined {
  if (nodeType === "user") {
    return "diagram-aws-icon diagram-aws-icon--user";
  }
  if (iconKey && /\busers?\b/i.test(iconKey)) {
    return "diagram-aws-icon diagram-aws-icon--user";
  }
  return "diagram-aws-icon";
}
