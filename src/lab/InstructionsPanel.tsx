import { useMemo } from "react";

// Minimal markdown block types — covers lab instruction content
type MdBlock =
  | { readonly kind: "heading"; readonly level: number; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "code"; readonly content: string };

function parseMarkdownBlocks(md: string): readonly MdBlock[] {
  const blocks: MdBlock[] = [];

  for (const raw of md.split("\n\n")) {
    const block = raw.trim();
    if (block === "") continue;

    // Headings
    const headingMatch = /^(#{1,3})\s+(.*)/.exec(block);
    if (headingMatch !== null) {
      blocks.push({ kind: "heading", level: headingMatch[1]!.length, text: headingMatch[2] ?? "" });
      continue;
    }

    // Unordered lists
    if (block.startsWith("- ")) {
      const items = block.split("\n").map((line) => line.replace(/^-\s*/, ""));
      blocks.push({ kind: "list", items });
      continue;
    }

    // Fenced code blocks
    if (block.startsWith("```")) {
      const lines = block.split("\n");
      blocks.push({ kind: "code", content: lines.slice(1, -1).join("\n") });
      continue;
    }

    blocks.push({ kind: "paragraph", text: block });
  }

  return blocks;
}

const HEADING_CLASSES: Record<number, string> = {
  1: "text-sm font-semibold mt-2 mb-1",
  2: "text-sm font-semibold mt-2 mb-1",
  3: "text-xs font-semibold mt-2 mb-1",
};

function MdBlockView({ block }: { readonly block: MdBlock }) {
  switch (block.kind) {
    case "heading": {
      const Tag = `h${Math.min(block.level + 1, 4)}` as "h2" | "h3" | "h4";
      return <Tag className={HEADING_CLASSES[block.level] ?? HEADING_CLASSES[3]}>{block.text}</Tag>;
    }
    case "list":
      return <ListItems items={block.items} />;
    case "code":
      return <pre className="bg-muted/50 rounded p-2 text-xs font-mono overflow-x-auto">{block.content}</pre>;
    case "paragraph":
      return <p>{block.text}</p>;
  }
}

type InstructionsPanelProps = {
  readonly instructions: string;
};

export function InstructionsPanel({ instructions }: InstructionsPanelProps) {
  const blocks = useMemo(() => parseMarkdownBlocks(instructions), [instructions]);

  return (
    <div className="flex h-full flex-col overflow-y-auto ide-scrollbar">
      <div className="ide-section-header border-b border-border">Instructions</div>
      <div className="prose prose-invert prose-sm max-w-none p-3 text-xs leading-relaxed">
        {blocks.map((block) => (
          <MdBlockView key={blockKey(block)} block={block} />
        ))}
      </div>
    </div>
  );
}

function blockKey(block: MdBlock): string {
  switch (block.kind) {
    case "heading":
      return `heading-${block.level}-${block.text}`;
    case "paragraph":
      return `paragraph-${block.text}`;
    case "list":
      return `list-${block.items.join("|")}`;
    case "code":
      return `code-${block.content.slice(0, 24)}`;
  }
}

function ListItems({ items }: { readonly items: readonly string[] }) {
  const counts = new Map<string, number>();
  return (
    <ul className="list-disc pl-4 space-y-0.5">
      {items.map((item) => {
        const next = (counts.get(item) ?? 0) + 1;
        counts.set(item, next);
        return <li key={`${item}-${next}`}>{item}</li>;
      })}
    </ul>
  );
}
