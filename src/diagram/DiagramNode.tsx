import { Cpu, Database, Inbox, Layers, Monitor, Server, User } from "lucide-react";
import { motion } from "motion/react";
import type { PositionedDiagramNode } from "./layout";
import { defaultAwsIconKey, resolveAwsIconComponent } from "./aws-icon-registry";
import { colors, fonts, fontSizes, spring, fade } from "@/app/theme";

type DiagramNodeProps = {
  readonly node: PositionedDiagramNode;
  readonly dimmed?: boolean;
};

const defaultIconKey = defaultAwsIconKey;
const LABEL_GAP = 10;
const ICON_PADDING = 6;

export function DiagramNode({ node, dimmed = false }: DiagramNodeProps) {
  if (!Number.isFinite(node.width) || !Number.isFinite(node.height)) {
    return null;
  }

  const nodeOpacity = dimmed ? 0.4 : 1;
  const iconKey = node.icon ?? defaultIconKey(node.nodeType);
  const AwsIcon = iconKey ? resolveAwsIconComponent(iconKey) : null;
  const LucideIcon = AwsIcon ? null : lucideIconFor(node.nodeType);
  const hasIcon = AwsIcon !== null || LucideIcon !== null;

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

  return (
    <motion.g
      animate={{ x: node.x, y: node.y, opacity: nodeOpacity }}
      initial={{ x: node.x, y: node.y, opacity: 0 }}
      transition={{ x: spring, y: spring, opacity: fade }}
      {...(!dimmed ? { "data-focused": true } : {})}
    >
      {AwsIcon ? (
        <AwsIcon
          size={iconSize}
          x={iconX}
          y={iconY}
          className={awsIconClassName(node.nodeType, iconKey)}
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
  if (iconKey && /\\busers?\\b/i.test(iconKey)) {
    return "diagram-aws-icon diagram-aws-icon--user";
  }
  return "diagram-aws-icon";
}
