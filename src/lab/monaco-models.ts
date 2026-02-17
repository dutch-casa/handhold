import * as monaco from "monaco-editor";
import { langFromExt, extFromPath } from "@/lab/monaco-lang";
import type { FileContent } from "@/lab/tauri/typescript";

// Singleton model registry for the entire workspace.
// Every model created here is visible to the TS worker via setEagerModelSync(true).

// Monaco 0.55+ exposes typescript defaults at top-level namespace
const ts = monaco.typescript;

function pathToUri(path: string): monaco.Uri {
  return monaco.Uri.parse(`file://${path}`);
}

export function seedModels(files: readonly FileContent[]): void {
  for (const file of files) {
    const uri = pathToUri(file.path);
    if (monaco.editor.getModel(uri)) continue;
    const ext = extFromPath(file.path);
    monaco.editor.createModel(file.content, langFromExt(ext), uri);
  }
}

export function seedExtraLibs(files: readonly FileContent[]): void {
  for (const file of files) {
    const uri = `file://${file.path}`;
    ts.typescriptDefaults.addExtraLib(file.content, uri);
    ts.javascriptDefaults.addExtraLib(file.content, uri);
  }
}

export function getOrCreateModel(
  path: string,
  content: string,
  lang: string,
): monaco.editor.ITextModel {
  const uri = pathToUri(path);
  return monaco.editor.getModel(uri) ?? monaco.editor.createModel(content, lang, uri);
}

export function disposeAllModels(): void {
  for (const model of monaco.editor.getModels()) {
    model.dispose();
  }
}
