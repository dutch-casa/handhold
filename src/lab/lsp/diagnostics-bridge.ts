import * as monaco from "monaco-editor";
import type { LspDiagnostic } from "@/types/lsp";

const LSP_TO_MONACO_SEVERITY: Record<number, monaco.MarkerSeverity> = {
  1: monaco.MarkerSeverity.Error,
  2: monaco.MarkerSeverity.Warning,
  3: monaco.MarkerSeverity.Info,
  4: monaco.MarkerSeverity.Hint,
};

export function applyLspDiagnostics(
  uri: string,
  diagnostics: readonly LspDiagnostic[],
  owner: string,
): void {
  const monacoUri = monaco.Uri.parse(uri);
  const model = monaco.editor.getModel(monacoUri);
  if (model === null) return;

  const markers: monaco.editor.IMarkerData[] = diagnostics.map((d) => ({
    severity: LSP_TO_MONACO_SEVERITY[d.severity] ?? monaco.MarkerSeverity.Info,
    message: d.message,
    source: d.source,
    startLineNumber: d.range.start.line + 1,
    startColumn: d.range.start.character + 1,
    endLineNumber: d.range.end.line + 1,
    endColumn: d.range.end.character + 1,
  }));

  monaco.editor.setModelMarkers(model, owner, markers);
}
