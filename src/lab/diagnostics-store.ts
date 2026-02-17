import { create } from "zustand";
import * as monaco from "monaco-editor";

export type Diagnostic = {
  readonly path: string;
  readonly line: number;
  readonly column: number;
  readonly message: string;
  readonly severity: "error" | "warning" | "info" | "hint";
  readonly source: string;
};

type DiagnosticsState = {
  readonly byFile: ReadonlyMap<string, readonly Diagnostic[]>;
  readonly errorCount: number;
  readonly warningCount: number;
};

const SEVERITY_MAP: Record<number, Diagnostic["severity"]> = {
  [monaco.MarkerSeverity.Error]: "error",
  [monaco.MarkerSeverity.Warning]: "warning",
  [monaco.MarkerSeverity.Info]: "info",
  [monaco.MarkerSeverity.Hint]: "hint",
};

function collectDiagnostics(): DiagnosticsState {
  const byFile = new Map<string, Diagnostic[]>();
  let errorCount = 0;
  let warningCount = 0;

  for (const model of monaco.editor.getModels()) {
    const uri = model.uri;
    if (uri.scheme !== "file") continue;

    const markers = monaco.editor.getModelMarkers({ resource: uri });
    if (markers.length === 0) continue;

    const diagnostics: Diagnostic[] = [];
    for (const m of markers) {
      const sev = SEVERITY_MAP[m.severity] ?? "info";
      if (sev === "error") errorCount++;
      if (sev === "warning") warningCount++;
      diagnostics.push({
        path: uri.path,
        line: m.startLineNumber,
        column: m.startColumn,
        message: m.message,
        severity: sev,
        source: m.source ?? "",
      });
    }

    byFile.set(uri.path, diagnostics);
  }

  return { byFile, errorCount, warningCount };
}

export const useDiagnosticsStore = create<DiagnosticsState>(() => ({
  byFile: new Map(),
  errorCount: 0,
  warningCount: 0,
}));

// Self-subscribing: Monaco marker changes drive store updates.
// Debounced via requestIdleCallback to batch rapid-fire events during typing.
let idleHandle: number | undefined;

monaco.editor.onDidChangeMarkers(() => {
  if (idleHandle !== undefined) cancelIdleCallback(idleHandle);
  idleHandle = requestIdleCallback(() => {
    useDiagnosticsStore.setState(collectDiagnostics());
  });
});
