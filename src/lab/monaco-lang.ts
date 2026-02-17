// File extension → Monaco language ID. Shared between Editor and model registry.

export const EXT_TO_LANG: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  java: "java",
  rs: "rust",
  sql: "sql",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  md: "markdown",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  toml: "ini",
  xml: "xml",
  dockerfile: "dockerfile",
  Dockerfile: "dockerfile",
  go: "go",
  kt: "kotlin",
  kts: "kotlin",
  ex: "elixir",
  exs: "elixir",
  rb: "ruby",
  zig: "zig",
  cs: "csharp",
};

export function langFromExt(ext: string): string {
  return EXT_TO_LANG[ext] ?? "plaintext";
}

export function extFromPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1);
}
