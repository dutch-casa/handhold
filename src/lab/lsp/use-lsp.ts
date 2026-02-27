import { useEffect, useRef, useCallback } from "react";
import { LspSession } from "@/lab/lsp/lsp-session";
import { lookupServer } from "@/lab/lsp/server-registry";
import { registerLspProviders } from "@/lab/lsp/monaco-adapters";
import { createDocumentSync } from "@/lab/lsp/document-sync";
import { applyLspDiagnostics } from "@/lab/lsp/diagnostics-bridge";

type UseLspOpts = {
  readonly workspacePath: string;
  readonly rootUri: string;
  readonly enabled: boolean;
};

export function useLsp(opts: UseLspOpts): {
  readonly getSession: (languageId: string) => LspSession | undefined;
} {
  const sessionsRef = useRef(new Map<string, LspSession>());

  const getSession = useCallback((languageId: string): LspSession | undefined => {
    const existing = sessionsRef.current.get(languageId);
    if (existing !== undefined) return existing;

    if (!opts.enabled) return undefined;

    const entry = lookupServer(languageId);
    if (entry === undefined) return undefined;

    const session = new LspSession({
      serverBinary: entry.server.binary,
      serverArgs: entry.server.args,
      rootPath: opts.workspacePath,
      rootUri: opts.rootUri,
      languageId: entry.lspId,
      onDiagnostics: (uri, diagnostics) => {
        applyLspDiagnostics(uri, diagnostics, entry.lspId);
      },
      onStateChange: () => {},
    });

    sessionsRef.current.set(languageId, session);
    session.start();
    return session;
  }, [opts.workspacePath, opts.rootUri, opts.enabled]);

  useEffect(() => {
    if (!opts.enabled) return;

    const providerDisposables = registerLspProviders({ getSession });
    const docSync = createDocumentSync(getSession);

    return () => {
      for (const d of providerDisposables) d.dispose();
      docSync.dispose();
      for (const session of sessionsRef.current.values()) session.dispose();
      sessionsRef.current.clear();
    };
  }, [opts.enabled, getSession]);

  return { getSession };
}
