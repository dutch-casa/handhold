// Diagnostic types and hook for the editor panels.
// Currently returns an empty array; actual computation wired when stores connect.

export type DiagnosticSeverity = "error" | "warning" | "info";

export type Diagnostic = {
  readonly severity: DiagnosticSeverity;
  readonly message: string;
  readonly stepId: string;
  readonly stepTitle: string;
  readonly location?: string | undefined; // e.g., "paragraph 2", "block: hash-fn", "trigger 3"
};

const EMPTY: readonly Diagnostic[] = [];

export function useDiagnostics(): readonly Diagnostic[] {
  return EMPTY;
}

// Derived counts from a diagnostic list.
export function countBySeverity(diagnostics: readonly Diagnostic[]) {
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  for (const d of diagnostics) {
    if (d.severity === "error") errors++;
    else if (d.severity === "warning") warnings++;
    else infos++;
  }
  return { errors, warnings, infos } as const;
}

// Group diagnostics by stepId, preserving insertion order.
export function groupByStep(
  diagnostics: readonly Diagnostic[],
): ReadonlyMap<string, readonly Diagnostic[]> {
  const map = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const existing = map.get(d.stepId);
    if (existing) {
      existing.push(d);
    } else {
      map.set(d.stepId, [d]);
    }
  }
  return map;
}
