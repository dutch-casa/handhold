import { useEffect } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { FileExplorerNode } from "@/lab/FileExplorerNode";
import type { FileTreeNode } from "@/types/lab";
import type { FileOps } from "@/lab/use-file-ops";
import { FolderTree, GripVertical } from "lucide-react";
import { FileIcon } from "@/lab/file-icons";

type FileExplorerProps = {
  readonly tree: readonly FileTreeNode[];
  readonly loading: boolean;
  readonly onSelect: (path: string) => void;
  readonly ops: FileOps;
};

function findNode(tree: readonly FileTreeNode[], path: string): FileTreeNode | undefined {
  for (const node of tree) {
    if (node.path === path) return node;
    if (node.kind === "dir") {
      const found = findNode(node.children, path);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function fileName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function FileExplorer({ tree, loading, onSelect, ops }: FileExplorerProps) {
  // Prevent browser default drop behavior (page navigation/refresh)
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
        <FolderTree className="size-6 opacity-50" />
        <span className="text-xs">No files</span>
      </div>
    );
  }

  return (
    <DragDropProvider
      onDragEnd={async (event) => {
        if (event.canceled) return;

        const source = event.operation?.source;
        const target = event.operation?.target;
        if (!source || !target) return;

        const sourcePath = String(source.id);
        const targetPath = String(target.id);

        // Don't drop onto self or into own subtree
        if (sourcePath === targetPath || targetPath.startsWith(sourcePath + "/")) return;

        const name = fileName(sourcePath);
        const destPath = `${targetPath}/${name}`;
        if (destPath === sourcePath) return;

        await ops.move(sourcePath, destPath);
      }}
    >
      <div className="flex flex-1 flex-col overflow-y-auto p-1" role="tree">
        {tree.map((node) => (
          <FileExplorerNode
            key={node.path}
            node={node}
            depth={0}
            onSelect={onSelect}
            ops={ops}
          />
        ))}
      </div>

      <DragOverlay>
        {(source) => {
          const node = findNode(tree, String(source.id));
          const name = node?.name ?? fileName(String(source.id));
          return (
            <div className="flex items-center gap-1.5 rounded bg-popover px-2 py-1 text-xs text-foreground shadow-lg ring-1 ring-foreground/10">
              <GripVertical className="size-3 text-muted-foreground" />
              {node?.kind === "dir" ? (
                <FolderTree className="size-3.5 text-primary/70" />
              ) : (
                <FileIcon name={name} ext={node?.ext ?? ""} />
              )}
              <span>{name}</span>
            </div>
          );
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}
