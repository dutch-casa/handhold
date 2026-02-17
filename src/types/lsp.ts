export type LspLanguageId =
  | "go" | "python" | "rust" | "c" | "cpp"
  | "java" | "csharp" | "elixir" | "sql"
  | "shellscript" | "dockerfile" | "kotlin"
  | "ruby" | "zig" | "tailwindcss";

export type LspSessionState =
  | { readonly kind: "spawning" }
  | { readonly kind: "initializing"; readonly sessionId: string }
  | { readonly kind: "ready"; readonly sessionId: string; readonly capabilities: ServerCapabilities }
  | { readonly kind: "failed"; readonly error: string }
  | { readonly kind: "stopped" };

export type ServerCapabilities = {
  readonly completionProvider: boolean;
  readonly hoverProvider: boolean;
  readonly definitionProvider: boolean;
  readonly signatureHelpProvider: boolean;
  readonly referencesProvider: boolean;
  readonly documentFormattingProvider: boolean;
};

export type LspDiagnostic = {
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
  readonly severity: 1 | 2 | 3 | 4;
  readonly message: string;
  readonly source: string;
};
