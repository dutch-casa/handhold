import { invoke } from "@tauri-apps/api/core";

export type SearchMatch = {
  readonly path: string;
  readonly lineNumber: number;
  readonly column: number;
  readonly lineContent: string;
  readonly matchLen: number;
};

export type SearchResult = {
  readonly matches: readonly SearchMatch[];
  readonly truncated: boolean;
};

export type SearchOpts = {
  readonly caseSensitive: boolean;
  readonly regex: boolean;
  readonly wholeWord: boolean;
};

export async function searchWorkspace(
  root: string,
  query: string,
  opts: SearchOpts,
): Promise<SearchResult> {
  return invoke<SearchResult>("search_workspace", {
    root,
    query,
    caseSensitive: opts.caseSensitive,
    regexMode: opts.regex,
    wholeWord: opts.wholeWord,
  });
}
