import { useEffect, useMemo } from "react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { FileExplorerNode, InlineInput } from "@/lab/FileExplorerNode";
import type { FileTreeNode, FileTreeDir } from "@/types/lab";
import type { FileOps } from "@/lab/use-file-ops";
import type { GitFileStatus } from "@/lab/tauri/git";
import { FolderTree, GripVertical, FilePlus, FolderPlus, Folder } from "lucide-react";
import { FileIcon } from "@/lab/file-icons";

type RootCreating = "new-file" | "new-folder";

type FileExplorerProps = {
  readonly tree: readonly FileTreeNode[];
  readonly loading: boolean;
  readonly rootPath: string;
  readonly onSelect: (path: string) => void;
  readonly ops: FileOps;
  readonly filter: string;
  readonly collapseKey: number;
  readonly rootCreating: RootCreating | undefined;
  readonly setRootCreating: (v: RootCreating | undefined) => void;
  readonly gitStatus: ReadonlyMap<string, GitFileStatus>;
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

function matchesFilter(name: string, query: string): boolean {
  return name.toLowerCase().includes(query);
}

function filterTree(nodes: readonly FileTreeNode[], query: string): readonly FileTreeNode[] {
  if (query === "") return nodes;
  const lowerQuery = query.toLowerCase();

  const result: FileTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === "file") {
      if (matchesFilter(node.name, lowerQuery)) result.push(node);
    } else {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        const filtered: FileTreeDir = {
          kind: "dir",
          path: node.path,
          name: node.name,
          get children() { return filteredChildren; },
        };
        result.push(filtered);
      } else if (matchesFilter(node.name, lowerQuery)) {
        result.push(node);
      }
    }
  }
  return result;
}

export function FileExplorer({
  tree,
  loading,
  rootPath,
  onSelect,
  ops,
  filter,
  collapseKey,
  rootCreating,
  setRootCreating,
  gitStatus,
}: FileExplorerProps) {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const filteredTree = useMemo(() => filterTree(tree, filter), [tree, filter]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (tree.length === 0 && rootCreating === undefined) {
    return (
      <ContextMenu>
        <ContextMenuTrigger className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-4 text-muted-foreground">
          <FolderTree className="size-6 opacity-50" />
          <span className="text-xs">No files</span>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setRootCreating("new-file")}>
            <FilePlus className="size-4" />
            New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setRootCreating("new-folder")}>
            <FolderPlus className="size-4" />
            New Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
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

        if (sourcePath === targetPath || targetPath.startsWith(sourcePath + "/")) return;

        const name = fileName(sourcePath);
        const destPath = `${targetPath}/${name}`;
        if (destPath === sourcePath) return;

        await ops.move(sourcePath, destPath);
      }}
    >
      <ContextMenu>
        <ContextMenuTrigger
          className="flex min-h-full flex-1 flex-col overflow-y-auto"
          onContextMenu={(e) => {
            // Only fire on empty space — node context menus stopPropagation
            const target = e.target as HTMLElement;
            const treeItem = target.closest("[role='treeitem']");
            if (treeItem) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
          }}
        >
          <div className="flex flex-1 flex-col p-1" role="tree" key={collapseKey}>
            {rootCreating !== undefined && (
              <div className="flex items-center gap-1.5 px-2 py-0.5" style={{ paddingLeft: "4px" }}>
                <span className="size-3 shrink-0" />
                {rootCreating === "new-folder" ? (
                  <Folder className="size-3.5 shrink-0 text-primary/70" />
                ) : (
                  <span className="size-3.5 shrink-0" />
                )}
                <InlineInput
                  defaultValue=""
                  onConfirm={async (name) => {
                    if (rootCreating === "new-file") {
                      await ops.createFile(`${rootPath}/${name}`);
                    } else {
                      await ops.createDir(`${rootPath}/${name}`);
                    }
                    setRootCreating(undefined);
                  }}
                  onCancel={() => setRootCreating(undefined)}
                />
              </div>
            )}
            {filteredTree.map((node) => (
              <FileExplorerNode
                key={node.path}
                node={node}
                depth={0}
                onSelect={onSelect}
                ops={ops}
                gitStatus={gitStatus}
              />
            ))}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent>
          <ContextMenuItem onClick={() => setRootCreating("new-file")}>
            <FilePlus className="size-4" />
            New File
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setRootCreating("new-folder")}>
            <FolderPlus className="size-4" />
            New Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

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
