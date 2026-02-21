import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Lightbulb } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon } from "@/lab/file-icons";
import { readTree } from "@/lab/tauri/workspace";
import { buildFileTree } from "@/lab/store";
import type { FileTreeNode } from "@/types/lab";

type SolutionPanelProps = {
  readonly solutionPath: string;
  readonly onOpenSolution: (path: string) => void;
};

export function SolutionPanel({ solutionPath, onOpenSolution }: SolutionPanelProps) {
  const { data: entries, isLoading } = useQuery({
    queryKey: ["solution-tree", solutionPath],
    queryFn: () => readTree(solutionPath),
  });

  const tree = useMemo(
    () => (entries ? buildFileTree(entries, solutionPath) : []),
    [entries, solutionPath],
  );

  return (
    <div className="flex h-full flex-col">
      <Collapsible defaultOpen className="flex flex-1 flex-col overflow-hidden">
        <CollapsibleTrigger className="ide-section-header border-b border-border">
          <ChevronRight className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
          <span>Solution Files</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-1 flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Loading...
              </div>
            ) : tree.length === 0 ? (
              <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
                <Lightbulb className="size-6 opacity-50" />
                <span className="text-xs">No solution files</span>
              </div>
            ) : (
              <div className="flex flex-col p-1" role="tree">
                {tree.map((node) => (
                  <SolutionNode
                    key={node.path}
                    node={node}
                    depth={0}
                    onSelect={onOpenSolution}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function SolutionNode({
  node,
  depth,
  onSelect,
}: {
  readonly node: FileTreeNode;
  readonly depth: number;
  readonly onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const indent = depth * 12 + 4;

  if (node.kind === "file") {
    return (
      <button
        type="button"
        role="treeitem"
        onClick={() => onSelect(node.path)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
        style={{ paddingLeft: `${indent + 16}px` }}
      >
        <FileIcon name={node.name} ext={node.ext} />
        <span className="truncate">{node.name}</span>
      </button>
    );
  }

  return (
    <div role="treeitem">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-xs text-foreground transition-colors hover:bg-muted"
        style={{ paddingLeft: `${indent}px` }}
      >
        <ChevronRight
          className={`size-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded
        ? node.children.map((child) => (
            <SolutionNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}
