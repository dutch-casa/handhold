import { useState } from "react";
import { CircleAlert, TriangleAlert, Info, ChevronRight, ChevronDown } from "lucide-react";
import { useDiagnosticsStore, type Diagnostic } from "@/lab/diagnostics-store";

type DiagnosticsPanelProps = {
  readonly onNavigate: (path: string, line: number, column: number) => void;
};

const SEVERITY_ICON = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  hint: Info,
} as const;

const SEVERITY_COLOR = {
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
  hint: "text-muted-foreground",
} as const;

function nameFromPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
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
      onClick={() => onNavigate(d.path, d.line, d.column)}
      className="flex w-full items-start gap-2 px-4 py-1 text-left text-xs hover:bg-muted/50"
    >
      <Icon className={`mt-0.5 size-3.5 shrink-0 ${color}`} />
      <span className="min-w-0 flex-1 break-words text-foreground">{d.message}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">
        [{d.line}:{d.column}]
      </span>
    </button>
  );
}

function FileGroup({
  path,
  diagnostics,
  onNavigate,
}: {
  readonly path: string;
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
        <span className="truncate">{nameFromPath(path)}</span>
        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
          {diagnostics.length}
        </span>
      </button>
      {expanded
        ? diagnostics.map((d) => (
            <DiagnosticRow
              key={`${d.path}:${d.line}:${d.column}:${d.message}`}
              d={d}
              onNavigate={onNavigate}
            />
          ))
        : null}
    </div>
  );
}

export function DiagnosticsPanel({ onNavigate }: DiagnosticsPanelProps) {
  const byFile = useDiagnosticsStore((s) => s.byFile);

  if (byFile.size === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        No problems detected
      </div>
    );
  }

  const entries: [string, readonly Diagnostic[]][] = [];
  byFile.forEach((diagnostics, path) => { entries.push([path, diagnostics]); });

  return (
    <div className="h-full overflow-y-auto">
      {entries.map(([path, diagnostics]) => (
        <FileGroup key={path} path={path} diagnostics={diagnostics} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
