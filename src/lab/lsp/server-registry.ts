import type { LspLanguageId } from "@/types/lsp";

type ServerEntry = {
  readonly binary: string;
  readonly args: readonly string[];
};

type RegistryEntry = {
  readonly lspId: LspLanguageId;
  readonly server: ServerEntry;
};

// Monaco language ID → LSP server config.
// noUncheckedIndexedAccess: lookupServer returns undefined for unmatched languages.
// typescript-language-server handles TS, TSX, JS, JSX via tsserver.
const TS_SERVER: ServerEntry = { binary: "typescript-language-server", args: ["--stdio"] };

const LSP_SERVERS: Readonly<Record<string, RegistryEntry | undefined>> = {
  typescript:      { lspId: "typescript",      server: TS_SERVER },
  typescriptreact: { lspId: "typescriptreact", server: TS_SERVER },
  javascript:      { lspId: "javascript",      server: TS_SERVER },
  javascriptreact: { lspId: "javascriptreact", server: TS_SERVER },
  html:            { lspId: "html",            server: { binary: "vscode-html-language-server",  args: ["--stdio"] } },
  css:             { lspId: "css",             server: { binary: "vscode-css-language-server",   args: ["--stdio"] } },
  json:            { lspId: "json",            server: { binary: "vscode-json-language-server",  args: ["--stdio"] } },
  go:              { lspId: "go",              server: { binary: "gopls",                        args: ["serve"] } },
  python:          { lspId: "python",          server: { binary: "pyright-langserver",           args: ["--stdio"] } },
  rust:            { lspId: "rust",            server: { binary: "rust-analyzer",                args: [] } },
  c:               { lspId: "c",              server: { binary: "clangd",                       args: ["--background-index"] } },
  cpp:             { lspId: "cpp",            server: { binary: "clangd",                       args: ["--background-index"] } },
  java:            { lspId: "java",           server: { binary: "jdtls",                        args: [] } },
  csharp:          { lspId: "csharp",         server: { binary: "OmniSharp",                    args: ["--languageserver"] } },
  elixir:          { lspId: "elixir",         server: { binary: "elixir-ls",                    args: [] } },
  sql:             { lspId: "sql",            server: { binary: "sqls",                         args: [] } },
  shell:           { lspId: "shellscript",    server: { binary: "bash-language-server",         args: ["start"] } },
  dockerfile:      { lspId: "dockerfile",     server: { binary: "docker-langserver",            args: ["--stdio"] } },
  kotlin:          { lspId: "kotlin",         server: { binary: "kotlin-language-server",       args: [] } },
  ruby:            { lspId: "ruby",           server: { binary: "solargraph",                   args: ["stdio"] } },
  zig:             { lspId: "zig",            server: { binary: "zls",                          args: [] } },
  tailwindcss:     { lspId: "tailwindcss",    server: { binary: "tailwindcss-language-server",  args: ["--stdio"] } },
};

export function lookupServer(monacoLangId: string): RegistryEntry | undefined {
  return LSP_SERVERS[monacoLangId];
}
