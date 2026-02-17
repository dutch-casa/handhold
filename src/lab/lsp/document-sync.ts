import * as monaco from "monaco-editor";
import type { LspSession } from "@/lab/lsp/lsp-session";
import { lookupServer } from "@/lab/lsp/server-registry";

type SessionLookup = (languageId: string) => LspSession | undefined;

export function createDocumentSync(getSession: SessionLookup): { dispose: () => void } {
  const versions = new Map<string, number>();
  const changeDisposables = new Map<string, monaco.IDisposable>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function nextVersion(uri: string): number {
    const v = (versions.get(uri) ?? 0) + 1;
    versions.set(uri, v);
    return v;
  }

  function handleModelAdded(model: monaco.editor.ITextModel): void {
    const langId = model.getLanguageId();
    if (lookupServer(langId) === undefined) return;

    const session = getSession(langId);
    if (session === undefined) return;

    const uri = model.uri.toString();
    const version = nextVersion(uri);
    session.didOpen(uri, langId, version, model.getValue());

    const changeSub = model.onDidChangeContent(() => {
      const existing = debounceTimers.get(uri);
      if (existing !== undefined) clearTimeout(existing);

      debounceTimers.set(uri, setTimeout(() => {
        debounceTimers.delete(uri);
        const s = getSession(langId);
        if (s === undefined) return;
        s.didChange(uri, nextVersion(uri), model.getValue());
      }, 100));
    });

    changeDisposables.set(uri, changeSub);
  }

  function handleModelRemoved(model: monaco.editor.ITextModel): void {
    const uri = model.uri.toString();
    const langId = model.getLanguageId();

    const timer = debounceTimers.get(uri);
    if (timer !== undefined) {
      clearTimeout(timer);
      debounceTimers.delete(uri);
    }

    changeDisposables.get(uri)?.dispose();
    changeDisposables.delete(uri);
    versions.delete(uri);

    const session = getSession(langId);
    if (session !== undefined) session.didClose(uri);
  }

  const createSub = monaco.editor.onDidCreateModel(handleModelAdded);
  const disposeSub = monaco.editor.onWillDisposeModel(handleModelRemoved);

  // Sync models that already exist
  for (const model of monaco.editor.getModels()) {
    handleModelAdded(model);
  }

  return {
    dispose() {
      createSub.dispose();
      disposeSub.dispose();
      for (const timer of debounceTimers.values()) clearTimeout(timer);
      for (const sub of changeDisposables.values()) sub.dispose();
      debounceTimers.clear();
      changeDisposables.clear();
      versions.clear();
    },
  };
}
