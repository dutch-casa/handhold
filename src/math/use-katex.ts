import { useQuery } from "@tanstack/react-query";
import katex from "katex";

type KatexResult = {
  readonly html: string;
  readonly width: number;
  readonly height: number;
};

function renderLatex(latex: string): KatexResult {
  const html = katex.renderToString(latex, {
    displayMode: true,
    throwOnError: false,
    output: "html",
  });

  // Measure by parsing the generated HTML
  // KaTeX output is deterministic so we can measure once
  const el = document.createElement("div");
  el.innerHTML = html;
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  el.style.whiteSpace = "nowrap";
  document.body.appendChild(el);
  const rect = el.getBoundingClientRect();
  document.body.removeChild(el);

  return { html, width: rect.width, height: rect.height };
}

export function useKatex(latex: string) {
  return useQuery({
    queryKey: ["katex", latex],
    queryFn: () => renderLatex(latex),
    staleTime: Infinity,
    enabled: latex.length > 0,
  });
}
