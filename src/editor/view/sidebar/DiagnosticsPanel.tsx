// Compact sidebar diagnostics: severity badges, collapsible step groups, truncated messages.

import { useState } from "react";
import {
  CircleAlert,
  TriangleAlert,
  Info,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  useDiagnostics,
  countBySeverity,
  groupByStep,
  type Diagnostic,
} from "@/editor/view/diagnostics";

type DiagnosticsPanelProps = {
  readonly onNavigate?: ((stepId: string, location?: string) => void) | undefined;
};

const SEVERITY_ICON = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

const SEVERITY_COLOR = {
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
} as const;

const BADGE_BG = {
  error: "bg-red-500/15 text-red-400",
  warning: "bg-yellow-500/15 text-yellow-400",
  info: "bg-blue-500/15 text-blue-400",
} as const;

function SeverityBadge({
  severity,
  count,
}: {
  readonly severity: Diagnostic["severity"];
  readonly count: number;
}) {
  if (count === 0) return null;

  const Icon = SEVERITY_ICON[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${BADGE_BG[severity]}`}
    >
      <Icon className="size-3" />
      {count}
    </span>
  );
}

function DiagnosticRow({
  d,
  onNavigate,
}: {
  readonly d: Diagnostic;
  readonly onNavigate: DiagnosticsPanelProps["onNavigate"];
}) {
  const Icon = SEVERITY_ICON[d.severity];
  const color = SEVERITY_COLOR[d.severity];

  return (
    <button
      onClick={() => onNavigate?.(d.stepId, d.location)}
      className="flex w-full items-start gap-2 px-4 py-1 text-left text-xs hover:bg-muted/50"
    >
      <Icon className={`mt-0.5 size-3.5 shrink-0 ${color}`} />
      <span className="min-w-0 flex-1 truncate text-foreground">{d.message}</span>
    </button>
  );
}

function StepGroup({
  stepTitle,
  diagnostics,
  onNavigate,
}: {
  readonly stepTitle: string;
  readonly diagnostics: readonly Diagnostic[];
  readonly onNavigate: DiagnosticsPanelProps["onNavigate"];
}) {
  const [expanded, setExpanded] = useState(true);
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-xs font-medium hover:bg-muted/50"
      >
        <Chevron className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{stepTitle}</span>
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
          {diagnostics.length}
        </span>
      </button>
      {expanded
        ? diagnostics.map((d, i) => (
            <DiagnosticRow
              key={`${d.stepId}:${d.severity}:${i}`}
              d={d}
              onNavigate={onNavigate}
            />
          ))
        : null}
    </div>
  );
}

export function DiagnosticsPanel({ onNavigate }: DiagnosticsPanelProps) {
  const diagnostics = useDiagnostics();
  const { errors, warnings, infos } = countBySeverity(diagnostics);
  const grouped = groupByStep(diagnostics);

  if (diagnostics.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No problems detected
      </div>
    );
  }

  const entries: [string, readonly Diagnostic[]][] = [];
  grouped.forEach((items, stepId) => {
    const first = items[0];
    if (first) entries.push([first.stepTitle, items]);
    else entries.push([stepId, items]);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <SeverityBadge severity="error" count={errors} />
        <SeverityBadge severity="warning" count={warnings} />
        <SeverityBadge severity="info" count={infos} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {entries.map(([title, items]) => (
          <StepGroup
            key={title}
            stepTitle={title}
            diagnostics={items}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
