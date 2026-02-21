import { useQuery } from "@tanstack/react-query";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// --- Token type consumed by rendering ---

export type ShikiToken = {
  readonly content: string;
  readonly color: string;
};

// --- Lazy singleton highlighter ---

let highlighterPromise: Promise<HighlighterCore> | null = null;

export function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [import("shiki/themes/github-dark-default.mjs")],
      langs: [
        import("shiki/langs/typescript.mjs"),
        import("shiki/langs/javascript.mjs"),
        import("shiki/langs/tsx.mjs"),
        import("shiki/langs/jsx.mjs"),
        import("shiki/langs/python.mjs"),
        import("shiki/langs/rust.mjs"),
        import("shiki/langs/go.mjs"),
        import("shiki/langs/java.mjs"),
        import("shiki/langs/c.mjs"),
        import("shiki/langs/cpp.mjs"),
        import("shiki/langs/sql.mjs"),
        import("shiki/langs/bash.mjs"),
        import("shiki/langs/json.mjs"),
        import("shiki/langs/yaml.mjs"),
        import("shiki/langs/html.mjs"),
        import("shiki/langs/css.mjs"),
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

// --- Tokenize: code string → ShikiToken[][] (lines of tokens) ---

async function tokenize(code: string, lang: string): Promise<readonly (readonly ShikiToken[])[]> {
  const highlighter = await getHighlighter();

  // Resolve lang — fall back to "text" (plaintext) if not loaded
  const loadedLangs = highlighter.getLoadedLanguages();
  const resolvedLang = loadedLangs.includes(lang) ? lang : "text";

  const { tokens } = highlighter.codeToTokens(code, {
    lang: resolvedLang,
    theme: "github-dark-default",
  });

  return tokens.map((line) =>
    line.map((token) => ({
      content: token.content,
      color: token.color ?? "#f1efe8",
    })),
  );
}

// --- React hook: tokenize with React Query caching ---

export function useShiki(code: string, lang: string) {
  return useQuery({
    queryKey: ["shiki", lang, code],
    queryFn: () => tokenize(code, lang),
    staleTime: Infinity,
  });
}

