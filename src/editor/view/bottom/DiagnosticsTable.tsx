// Full bottom-bar diagnostics table: severity icon, message, step name, location.

import { useState } from "react";
import { CircleAlert, TriangleAlert, Info, Search } from "lucide-react";
import { useDiagnostics, countBySeverity, type Diagnostic } from "@/editor/view/diagnostics";

type DiagnosticsTableProps = {
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

function matches(d: Diagnostic, query: string): boolean {
  if (query === "") return true;
  const q = query.toLowerCase();
  return (
    d.message.toLowerCase().includes(q) ||
    d.stepTitle.toLowerCase().includes(q) ||
    (d.location !== undefined && d.location.toLowerCase().includes(q))
  );
}

export function DiagnosticsTable({ onNavigate }: DiagnosticsTableProps) {
  const diagnostics = useDiagnostics();
  const { errors, warnings, infos } = countBySeverity(diagnostics);
  const [filter, setFilter] = useState("");

  const filtered = filter === "" ? diagnostics : diagnostics.filter((d) => matches(d, filter));

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Header: counts + search */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-1.5">
        <span className="font-medium text-foreground">Problems</span>
        <span className="tabular-nums text-red-400">{errors}</span>
        <span className="tabular-nums text-yellow-400">{warnings}</span>
        <span className="tabular-nums text-blue-400">{infos}</span>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter"
            className="h-6 w-40 rounded border border-border bg-transparent pl-6 pr-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            {diagnostics.length === 0 ? "No problems detected" : "No matching problems"}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-background">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="w-8 px-3 py-1" />
                <th className="px-2 py-1">Message</th>
                <th className="w-40 px-2 py-1">Step</th>
                <th className="w-32 px-2 py-1">Location</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, i) => {
                const Icon = SEVERITY_ICON[d.severity];
                const color = SEVERITY_COLOR[d.severity];
                return (
                  <tr
                    key={`${d.stepId}:${d.severity}:${i}`}
                    onClick={() => onNavigate?.(d.stepId, d.location)}
                    className="cursor-pointer border-b border-border/50 hover:bg-muted/50"
                  >
                    <td className="px-3 py-1">
                      <Icon className={`size-3.5 ${color}`} />
                    </td>
                    <td className="px-2 py-1 text-foreground">{d.message}</td>
                    <td className="truncate px-2 py-1 text-muted-foreground">{d.stepTitle}</td>
                    <td className="truncate px-2 py-1 text-muted-foreground">
                      {d.location ?? ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
