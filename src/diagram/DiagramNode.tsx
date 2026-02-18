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
  "load-balancer": {
    stroke: colors.accent,
    strokeDasharray: "none",
    rx: Number.parseFloat(radii.md),
  },
  "api-gateway": {
    stroke: colors.accent,
    strokeDasharray: "none",
    rx: Number.parseFloat(radii.md),
  },
  "message-queue": {
    stroke: colors.error,
    strokeDasharray: "6 3",
    rx: Number.parseFloat(radii.lg),
  },
  user: {
    stroke: colors.text,
    strokeDasharray: "none",
    rx: Number.parseFloat(radii.lg),
  },
  server: {
    stroke: colors.accent,
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
      {renderNodeShape(node, style, strokeColor)}
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

const STROKE_W = 1.5;

function renderNodeShape(
  node: PositionedDiagramNode,
  style: NodeStyle,
  strokeColor: string,
): React.ReactNode {
  switch (node.nodeType) {
    case "database":
      return renderDatabase(node, strokeColor, style.strokeDasharray);
    case "cache":
      return renderStacked(node, strokeColor, style.strokeDasharray, 3);
    case "queue":
    case "message-queue":
      return renderQueue(node, strokeColor, style.strokeDasharray);
    case "load-balancer":
      return renderHex(node, strokeColor, style.strokeDasharray);
    case "api-gateway":
      return renderGateway(node, strokeColor, style.strokeDasharray);
    case "user":
      return renderUser(node, strokeColor, style.strokeDasharray);
    case "server":
      return renderServer(node, strokeColor, style.strokeDasharray);
    case "client":
      return renderClient(node, strokeColor, style.strokeDasharray);
    default:
      return renderRect(node, strokeColor, style.strokeDasharray, style.rx);
  }
}

function renderRect(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
  rx: number,
): React.ReactNode {
  return (
    <rect
      width={node.width}
      height={node.height}
      rx={rx}
      fill={colors.surface}
      stroke={strokeColor}
      strokeWidth={STROKE_W}
      strokeDasharray={strokeDasharray}
    />
  );
}

function renderDatabase(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
): React.ReactNode {
  const w = node.width;
  const h = node.height;
  const rx = w * 0.28;
  const ry = Math.min(10, h * 0.18);
  const topY = 6;
  const bottomY = h - 6;
  return (
    <g>
      <rect
        x={0}
        y={topY}
        width={w}
        height={bottomY - topY}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
      <ellipse
        cx={w / 2}
        cy={topY}
        rx={rx}
        ry={ry}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
      <ellipse
        cx={w / 2}
        cy={bottomY}
        rx={rx}
        ry={ry}
        fill="none"
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
    </g>
  );
}

function renderStacked(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
  layers: number,
): React.ReactNode {
  const w = node.width;
  const h = node.height;
  const pad = 6;
  const offset = 6;
  const layerH = (h - pad * 2) - offset * (layers - 1);
  const baseY = pad + offset * (layers - 1);
  return (
    <g>
      {Array.from({ length: layers }).map((_, i) => {
        const dy = offset * (layers - 1 - i);
        return (
          <rect
            key={i}
            x={pad + dy}
            y={pad + dy}
            width={w - pad * 2}
            height={layerH}
            rx={Number.parseFloat(radii.sm)}
            fill={colors.surface}
            stroke={strokeColor}
            strokeWidth={STROKE_W}
            strokeDasharray={strokeDasharray}
          />
        );
      })}
      <rect
        x={pad}
        y={baseY}
        width={w - pad * 2}
        height={layerH}
        rx={Number.parseFloat(radii.sm)}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
    </g>
  );
}

function renderQueue(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
): React.ReactNode {
  return renderStacked(node, strokeColor, strokeDasharray, 4);
}

function renderHex(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
): React.ReactNode {
  const w = node.width;
  const h = node.height;
  const inset = Math.min(16, w * 0.2);
  const points = [
    [inset, 0],
    [w - inset, 0],
    [w, h / 2],
    [w - inset, h],
    [inset, h],
    [0, h / 2],
  ]
    .map((p) => p.join(","))
    .join(" ");
  return (
    <polygon
      points={points}
      fill={colors.surface}
      stroke={strokeColor}
      strokeWidth={STROKE_W}
      strokeDasharray={strokeDasharray}
    />
  );
}

function renderGateway(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
): React.ReactNode {
  const w = node.width;
  const h = node.height;
  const pad = 6;
  const archW = w - pad * 2;
  const archH = h - pad * 2;
  const r = Math.min(archW / 2, 16);
  return (
    <path
      d={[
        `M ${pad} ${h - pad}`,
        `L ${pad} ${pad + r}`,
        `Q ${pad} ${pad} ${pad + r} ${pad}`,
        `L ${w - pad - r} ${pad}`,
        `Q ${w - pad} ${pad} ${w - pad} ${pad + r}`,
        `L ${w - pad} ${h - pad}`,
        `Z`,
      ].join(" ")}
      fill={colors.surface}
      stroke={strokeColor}
      strokeWidth={STROKE_W}
      strokeDasharray={strokeDasharray}
    />
  );
}

function renderUser(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
): React.ReactNode {
  const w = node.width;
  const h = node.height;
  const headR = Math.min(12, w * 0.16);
  const headCx = w / 2;
  const headCy = h * 0.34;
  const bodyW = w * 0.5;
  const bodyH = h * 0.32;
  const bodyX = (w - bodyW) / 2;
  const bodyY = headCy + headR + 6;
  return (
    <g>
      <circle
        cx={headCx}
        cy={headCy}
        r={headR}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
      <rect
        x={bodyX}
        y={bodyY}
        width={bodyW}
        height={bodyH}
        rx={Number.parseFloat(radii.lg)}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
    </g>
  );
}

function renderServer(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
): React.ReactNode {
  const w = node.width;
  const h = node.height;
  const pad = 8;
  const slotH = (h - pad * 2) / 3;
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={2}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
      {Array.from({ length: 3 }).map((_, i) => (
        <rect
          key={i}
          x={pad}
          y={pad + i * slotH}
          width={w - pad * 2}
          height={slotH - 6}
          rx={2}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1}
          strokeDasharray="none"
        />
      ))}
    </g>
  );
}

function renderClient(
  node: PositionedDiagramNode,
  strokeColor: string,
  strokeDasharray: string,
): React.ReactNode {
  const w = node.width;
  const h = node.height;
  const screenH = h * 0.65;
  const baseH = h - screenH;
  return (
    <g>
      <rect
        x={0}
        y={0}
        width={w}
        height={screenH}
        rx={Number.parseFloat(radii.sm)}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
      <rect
        x={w * 0.35}
        y={screenH + 4}
        width={w * 0.3}
        height={baseH - 8}
        rx={2}
        fill={colors.surface}
        stroke={strokeColor}
        strokeWidth={STROKE_W}
        strokeDasharray={strokeDasharray}
      />
    </g>
  );
}
