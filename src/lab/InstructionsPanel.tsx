import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getHighlighter } from "@/code/use-shiki";

// --- Shiki-highlighted code block (async via React Query) ---

function ShikiCodeBlock({ code, lang }: { readonly code: string; readonly lang: string }) {
  const { data: html } = useQuery({
    queryKey: ["shiki-html", lang, code],
    queryFn: async () => {
      const highlighter = await getHighlighter();
      const loaded = highlighter.getLoadedLanguages();
      const resolved = loaded.includes(lang) ? lang : "text";
      return highlighter.codeToHtml(code, {
        lang: resolved,
        theme: "github-dark-default",
      });
    },
    staleTime: Infinity,
  });

  if (html === undefined) {
    return (
      <pre className="instructions-code-block">
        <code>{code}</code>
      </pre>
    );
  }

  return (
    <div
      className="instructions-code-block [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_code]:!text-[length:inherit] [&_code]:!leading-[inherit]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// --- Component overrides that don't need state ---

const STATIC_COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="text-ide-sm font-semibold mt-4 mb-2 text-foreground">{children}</h2>,
  h2: ({ children }) => <h3 className="text-ide-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>,
  h3: ({ children }) => <h4 className="text-ide-xs font-semibold mt-3 mb-1 text-foreground">{children}</h4>,
  h4: ({ children }) => <h5 className="text-ide-xs font-medium mt-2 mb-1 text-muted-foreground">{children}</h5>,

  p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,

  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,

  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-2 border-primary/50 pl-3 text-muted-foreground italic">
      {children}
    </blockquote>
  ),

  a: ({ href, children }) => (
    <a href={href} className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),

  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,

  code: ({ className, children }) => {
    const langMatch = /language-(\w+)/.exec(className ?? "");
    const lang = langMatch?.[1];
    const text = String(children).replace(/\n$/, "");

    if (lang !== undefined) {
      return <ShikiCodeBlock code={text} lang={lang} />;
    }

    return (
      <code className="rounded bg-[#1a1a1a] px-1.5 py-0.5 text-[0.9em] font-mono text-primary">
        {children}
      </code>
    );
  },

  pre: ({ children }) => <>{children}</>,

  hr: () => <hr className="my-4 border-border" />,

  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto">
      <table className="w-full text-left text-ide-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="border-b border-border text-muted-foreground">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-border/50">{children}</tbody>,
  tr: ({ children }) => <tr>{children}</tr>,
  th: ({ children }) => <th className="px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-2 py-1">{children}</td>,

  img: ({ src, alt }) => (
    <img src={src} alt={alt ?? ""} className="my-2 max-w-full rounded" />
  ),
};

// --- Main panel ---

type InstructionsPanelProps = {
  readonly instructions: string;
  readonly onViewSolution?: (() => void) | undefined;
};

export function InstructionsPanel({ instructions, onViewSolution }: InstructionsPanelProps) {
  const [toggled, setToggled] = useState<ReadonlySet<number>>(() => new Set());
  const taskIndex = useRef(0);

  // Reset counter each render — react-markdown renders synchronously,
  // so the Nth checkbox always gets index N.
  taskIndex.current = 0;

  const toggle = (idx: number) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const components: Components = {
    ...STATIC_COMPONENTS,

    ul: ({ className, children }) => {
      if (className?.includes("contains-task-list") === true) {
        return <ul className="mb-2 list-none space-y-1">{children}</ul>;
      }
      return <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>;
    },

    li: ({ className, children }) => {
      if (className?.includes("task-list-item") === true) {
        return <li className="leading-relaxed [&>p]:inline">{children}</li>;
      }
      return <li className="leading-relaxed">{children}</li>;
    },

    input: ({ checked }) => {
      const idx = taskIndex.current++;
      const isChecked = toggled.has(idx) ? !(checked === true) : (checked === true);
      return (
        <input
          type="checkbox"
          checked={isChecked}
          onChange={() => toggle(idx)}
          className="mr-1.5 align-middle accent-primary cursor-pointer"
        />
      );
    },
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto ide-scrollbar">
      <div className="ide-section-header border-b border-border">Instructions</div>
      <div className="instructions-prose p-3">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {instructions}
        </ReactMarkdown>
        {onViewSolution !== undefined ? (
          <button
            type="button"
            onClick={onViewSolution}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Lightbulb className="size-3.5" />
            View Solution
          </button>
        ) : null}
      </div>
    </div>
  );
}
