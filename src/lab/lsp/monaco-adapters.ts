import * as monaco from "monaco-editor";
import type { LspSession } from "@/lab/lsp/lsp-session";

export type SessionProvider = {
  getSession(languageId: string): LspSession | undefined;
};

// LSP CompletionItemKind (1-based) → Monaco CompletionItemKind
const COMPLETION_KIND_MAP: Record<number, monaco.languages.CompletionItemKind | undefined> = {
  1: monaco.languages.CompletionItemKind.Text,
  2: monaco.languages.CompletionItemKind.Method,
  3: monaco.languages.CompletionItemKind.Function,
  4: monaco.languages.CompletionItemKind.Constructor,
  5: monaco.languages.CompletionItemKind.Field,
  6: monaco.languages.CompletionItemKind.Variable,
  7: monaco.languages.CompletionItemKind.Class,
  8: monaco.languages.CompletionItemKind.Interface,
  9: monaco.languages.CompletionItemKind.Module,
  10: monaco.languages.CompletionItemKind.Property,
  11: monaco.languages.CompletionItemKind.Unit,
  12: monaco.languages.CompletionItemKind.Value,
  13: monaco.languages.CompletionItemKind.Enum,
  14: monaco.languages.CompletionItemKind.Keyword,
  15: monaco.languages.CompletionItemKind.Snippet,
  16: monaco.languages.CompletionItemKind.Color,
  17: monaco.languages.CompletionItemKind.File,
  18: monaco.languages.CompletionItemKind.Reference,
  19: monaco.languages.CompletionItemKind.Folder,
  20: monaco.languages.CompletionItemKind.EnumMember,
  21: monaco.languages.CompletionItemKind.Constant,
  22: monaco.languages.CompletionItemKind.Struct,
  23: monaco.languages.CompletionItemKind.Event,
  24: monaco.languages.CompletionItemKind.Operator,
  25: monaco.languages.CompletionItemKind.TypeParameter,
};

type LspCompletionItem = {
  readonly label?: string | { readonly label: string };
  readonly kind?: number;
  readonly detail?: string;
  readonly documentation?: string | { readonly value: string };
  readonly insertText?: string;
  readonly filterText?: string;
  readonly sortText?: string;
};

function convertCompletionResult(
  result: unknown,
  range: monaco.IRange,
): monaco.languages.CompletionList {
  if (result === null || result === undefined) return { suggestions: [] };

  const items: readonly LspCompletionItem[] = Array.isArray(result)
    ? result as readonly LspCompletionItem[]
    : ((result as { items?: readonly LspCompletionItem[] }).items ?? []);

  const suggestions: monaco.languages.CompletionItem[] = [];
  for (const item of items) {
    const label = typeof item.label === "string"
      ? item.label
      : item.label?.label ?? "";
    if (label === "") continue;

    const doc = typeof item.documentation === "string"
      ? item.documentation
      : item.documentation?.value;

    const entry: monaco.languages.CompletionItem = {
      label,
      kind: COMPLETION_KIND_MAP[item.kind ?? 1] ?? monaco.languages.CompletionItemKind.Text,
      insertText: item.insertText ?? label,
      range,
    };
    if (item.detail !== undefined) entry.detail = item.detail;
    if (doc !== undefined) entry.documentation = doc;
    if (item.filterText !== undefined) entry.filterText = item.filterText;
    if (item.sortText !== undefined) entry.sortText = item.sortText;

    suggestions.push(entry);
  }

  return { suggestions };
}

type LspMarkedString = string | { readonly value: string; readonly language?: string };

type LspHoverResult = {
  readonly contents?: LspMarkedString | readonly LspMarkedString[];
  readonly range?: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
} | null;

function markedStringToMarkdown(c: LspMarkedString): monaco.IMarkdownString {
  if (typeof c === "string") return { value: c };
  const lang = c.language ?? "";
  return { value: lang ? `\`\`\`${lang}\n${c.value}\n\`\`\`` : c.value };
}

function convertHoverResult(result: unknown): monaco.languages.Hover | undefined {
  if (result === null || result === undefined) return undefined;
  const hover = result as LspHoverResult;
  if (hover === null || hover.contents === undefined) return undefined;

  const rawContents = hover.contents;
  const contents: monaco.IMarkdownString[] = Array.isArray(rawContents)
    ? (rawContents as readonly LspMarkedString[]).map(markedStringToMarkdown)
    : [markedStringToMarkdown(rawContents as LspMarkedString)];

  if (contents.length === 0) return undefined;

  const monacoHover: monaco.languages.Hover = { contents };
  if (hover.range !== undefined) {
    (monacoHover as { range: monaco.IRange }).range = {
      startLineNumber: hover.range.start.line + 1,
      startColumn: hover.range.start.character + 1,
      endLineNumber: hover.range.end.line + 1,
      endColumn: hover.range.end.character + 1,
    };
  }
  return monacoHover;
}

type LspLocation = {
  readonly uri: string;
  readonly range: {
    readonly start: { readonly line: number; readonly character: number };
    readonly end: { readonly line: number; readonly character: number };
  };
};

function convertDefinitionResult(result: unknown): monaco.languages.Definition | undefined {
  if (result === null || result === undefined) return undefined;

  const locations: LspLocation[] = Array.isArray(result)
    ? result as LspLocation[]
    : [result as LspLocation];

  const definitions: monaco.languages.Location[] = [];
  for (const loc of locations) {
    if (loc.uri === undefined || loc.range === undefined) continue;
    definitions.push({
      uri: monaco.Uri.parse(loc.uri),
      range: {
        startLineNumber: loc.range.start.line + 1,
        startColumn: loc.range.start.character + 1,
        endLineNumber: loc.range.end.line + 1,
        endColumn: loc.range.end.character + 1,
      },
    });
  }

  return definitions.length === 0 ? undefined : definitions;
}

type LspSignatureHelp = {
  readonly signatures?: readonly {
    readonly label: string;
    readonly documentation?: string | { readonly value: string };
    readonly parameters?: readonly {
      readonly label: string | readonly [number, number];
      readonly documentation?: string | { readonly value: string };
    }[];
  }[];
  readonly activeSignature?: number;
  readonly activeParameter?: number;
} | null;

function convertSignatureHelpResult(
  result: unknown,
): monaco.languages.SignatureHelpResult | undefined {
  if (result === null || result === undefined) return undefined;
  const sig = result as LspSignatureHelp;
  if (sig === null || sig.signatures === undefined || sig.signatures.length === 0) return undefined;

  const signatures: monaco.languages.SignatureInformation[] = [];
  for (const s of sig.signatures) {
    const doc = typeof s.documentation === "string"
      ? s.documentation
      : s.documentation?.value;

    const parameters: monaco.languages.ParameterInformation[] = [];
    if (s.parameters !== undefined) {
      for (const p of s.parameters) {
        const pDoc = typeof p.documentation === "string"
          ? p.documentation
          : p.documentation?.value;
        const param: monaco.languages.ParameterInformation = {
          label: p.label as string | [number, number],
        };
        if (pDoc !== undefined) param.documentation = pDoc;
        parameters.push(param);
      }
    }

    const sigInfo: monaco.languages.SignatureInformation = { label: s.label, parameters };
    if (doc !== undefined) sigInfo.documentation = doc;
    signatures.push(sigInfo);
  }

  return {
    value: {
      signatures,
      activeSignature: sig.activeSignature ?? 0,
      activeParameter: sig.activeParameter ?? 0,
    },
    dispose: () => {},
  };
}

function uriForModel(model: monaco.editor.ITextModel): string {
  return model.uri.toString();
}

export function registerLspProviders(
  provider: SessionProvider,
): readonly monaco.IDisposable[] {
  const disposables: monaco.IDisposable[] = [];

  disposables.push(
    monaco.languages.registerCompletionItemProvider("*", {
      triggerCharacters: [".", ":", "<", '"', "'", "/", "@", "#"],
      async provideCompletionItems(model, position) {
        const session = provider.getSession(model.getLanguageId());
        if (session === undefined) return undefined;
        if (!session.getCapabilities().completionProvider) return undefined;

        const word = model.getWordUntilPosition(position);
        const range: monaco.IRange = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        };

        const result = await session.completion(
          uriForModel(model),
          position.lineNumber - 1,
          position.column - 1,
        );
        return convertCompletionResult(result, range);
      },
    }),
  );

  disposables.push(
    monaco.languages.registerHoverProvider("*", {
      async provideHover(model, position) {
        const session = provider.getSession(model.getLanguageId());
        if (session === undefined) return undefined;
        if (!session.getCapabilities().hoverProvider) return undefined;

        const result = await session.hover(
          uriForModel(model),
          position.lineNumber - 1,
          position.column - 1,
        );
        return convertHoverResult(result);
      },
    }),
  );

  disposables.push(
    monaco.languages.registerDefinitionProvider("*", {
      async provideDefinition(model, position) {
        const session = provider.getSession(model.getLanguageId());
        if (session === undefined) return undefined;
        if (!session.getCapabilities().definitionProvider) return undefined;

        const result = await session.definition(
          uriForModel(model),
          position.lineNumber - 1,
          position.column - 1,
        );
        return convertDefinitionResult(result);
      },
    }),
  );

  disposables.push(
    monaco.languages.registerSignatureHelpProvider("*", {
      signatureHelpTriggerCharacters: ["(", ","],
      async provideSignatureHelp(model, position) {
        const session = provider.getSession(model.getLanguageId());
        if (session === undefined) return undefined;
        if (!session.getCapabilities().signatureHelpProvider) return undefined;

        const result = await session.signatureHelp(
          uriForModel(model),
          position.lineNumber - 1,
          position.column - 1,
        );
        return convertSignatureHelpResult(result);
      },
    }),
  );

  return disposables;
}
