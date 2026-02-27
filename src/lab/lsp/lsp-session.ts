import type { LspLanguageId, LspSessionState, ServerCapabilities, LspDiagnostic } from "@/types/lsp";
import { spawnLsp, type LspHandle } from "@/lab/tauri/lsp";
import { JsonRpcClient } from "@/lab/lsp/jsonrpc";

// LSP client capabilities declared to the server during initialize.
// Kept minimal — only features we actually consume.
const CLIENT_CAPABILITIES = {
  textDocument: {
    synchronization: {
      dynamicRegistration: false,
      willSave: false,
      willSaveWaitUntil: false,
      didSave: true,
    },
    completion: {
      dynamicRegistration: false,
      completionItem: {
        snippetSupport: false,
        documentationFormat: ["plaintext", "markdown"],
      },
    },
    hover: {
      dynamicRegistration: false,
      contentFormat: ["plaintext", "markdown"],
    },
    signatureHelp: {
      dynamicRegistration: false,
      signatureInformation: {
        documentationFormat: ["plaintext", "markdown"],
      },
    },
    definition: { dynamicRegistration: false },
    references: { dynamicRegistration: false },
    publishDiagnostics: { relatedInformation: false },
  },
} as const;

function extractCapabilities(result: unknown): ServerCapabilities {
  const caps = (result as { capabilities?: Record<string, unknown> } | undefined)?.capabilities;
  if (caps === undefined) {
    return {
      completionProvider: false,
      hoverProvider: false,
      definitionProvider: false,
      signatureHelpProvider: false,
      referencesProvider: false,
      documentFormattingProvider: false,
    };
  }
  return {
    completionProvider: caps["completionProvider"] !== undefined,
    hoverProvider: caps["hoverProvider"] !== undefined,
    definitionProvider: caps["definitionProvider"] !== undefined,
    signatureHelpProvider: caps["signatureHelpProvider"] !== undefined,
    referencesProvider: caps["referencesProvider"] !== undefined,
    documentFormattingProvider: caps["documentFormattingProvider"] !== undefined,
  };
}

type LspSessionOpts = {
  readonly serverBinary: string;
  readonly serverArgs: readonly string[];
  readonly rootPath: string;
  readonly rootUri: string;
  readonly languageId: LspLanguageId;
  readonly onDiagnostics: (uri: string, diagnostics: readonly LspDiagnostic[]) => void;
  readonly onStateChange: (state: LspSessionState) => void;
};

export class LspSession {
  private handle: LspHandle | undefined;
  private rpc: JsonRpcClient | undefined;
  private capabilities: ServerCapabilities = {
    completionProvider: false,
    hoverProvider: false,
    definitionProvider: false,
    signatureHelpProvider: false,
    referencesProvider: false,
    documentFormattingProvider: false,
  };
  private disposed = false;

  constructor(private readonly opts: LspSessionOpts) {}

  async start(): Promise<void> {
    if (this.disposed) return;

    this.opts.onStateChange({ kind: "spawning" });

    try {
      const handle = await spawnLsp(
        this.opts.serverBinary,
        this.opts.serverArgs,
        this.opts.rootPath,
      );
      if (this.disposed) {
        handle.kill();
        return;
      }

      this.handle = handle;
      const rpc = new JsonRpcClient((data) => handle.send(data));
      this.rpc = rpc;

      handle.onMessage((json) => rpc.handleMessage(json));
      handle.onExit(() => {
        if (!this.disposed) {
          this.opts.onStateChange({ kind: "stopped" });
        }
      });

      // Register diagnostics handler before initialize to not miss early diagnostics
      rpc.onNotification("textDocument/publishDiagnostics", (params) => {
        const p = params as { uri?: string; diagnostics?: readonly LspDiagnostic[] } | undefined;
        if (p?.uri !== undefined && p.diagnostics !== undefined) {
          this.opts.onDiagnostics(p.uri, p.diagnostics);
        }
      });

      this.opts.onStateChange({ kind: "initializing", sessionId: handle.sessionId });

      const initResult = await rpc.request("initialize", {
        processId: null,
        rootUri: this.opts.rootUri,
        capabilities: CLIENT_CAPABILITIES,
      });

      if (this.disposed) return;

      this.capabilities = extractCapabilities(initResult);
      rpc.notify("initialized", {});

      this.opts.onStateChange({
        kind: "ready",
        sessionId: handle.sessionId,
        capabilities: this.capabilities,
      });
    } catch (err) {
      if (!this.disposed) {
        this.opts.onStateChange({
          kind: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  didOpen(uri: string, languageId: string, version: number, text: string): void {
    this.rpc?.notify("textDocument/didOpen", {
      textDocument: { uri, languageId, version, text },
    });
  }

  didChange(uri: string, version: number, text: string): void {
    this.rpc?.notify("textDocument/didChange", {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    });
  }

  didClose(uri: string): void {
    this.rpc?.notify("textDocument/didClose", {
      textDocument: { uri },
    });
  }

  didSave(uri: string, text: string): void {
    this.rpc?.notify("textDocument/didSave", {
      textDocument: { uri },
      text,
    });
  }

  async completion(uri: string, line: number, character: number): Promise<unknown> {
    if (!this.capabilities.completionProvider) return undefined;
    return this.rpc?.request("textDocument/completion", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async hover(uri: string, line: number, character: number): Promise<unknown> {
    if (!this.capabilities.hoverProvider) return undefined;
    return this.rpc?.request("textDocument/hover", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async definition(uri: string, line: number, character: number): Promise<unknown> {
    if (!this.capabilities.definitionProvider) return undefined;
    return this.rpc?.request("textDocument/definition", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async signatureHelp(uri: string, line: number, character: number): Promise<unknown> {
    if (!this.capabilities.signatureHelpProvider) return undefined;
    return this.rpc?.request("textDocument/signatureHelp", {
      textDocument: { uri },
      position: { line, character },
    });
  }

  async references(uri: string, line: number, character: number): Promise<unknown> {
    if (!this.capabilities.referencesProvider) return undefined;
    return this.rpc?.request("textDocument/references", {
      textDocument: { uri },
      position: { line, character },
      context: { includeDeclaration: true },
    });
  }

  getCapabilities(): ServerCapabilities {
    return this.capabilities;
  }

  dispose(): void {
    this.disposed = true;
    this.rpc?.dispose();
    this.handle?.kill();
    this.rpc = undefined;
    this.handle = undefined;
  }
}
