import { useState, useRef, useEffect } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import type { FileTreeNode } from "@/types/lab";
import type { FileOps } from "@/lab/use-file-ops";
import { ChevronRight, Folder, FolderOpen, FilePlus, FolderPlus, Pencil, Trash2, Copy } from "lucide-react";
import { FileIcon } from "@/lab/file-icons";

type FileExplorerNodeProps = {
  readonly node: FileTreeNode;
  readonly depth: number;
  readonly onSelect: (path: string) => void;
  readonly ops: FileOps;
};

function InlineInput({
  defaultValue,
  onConfirm,
  onCancel,
}: {
  readonly defaultValue: string;
  readonly onConfirm: (value: string) => void;
  readonly onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const input = ref.current;
    if (input === null) return;
    input.focus();
    const dot = defaultValue.lastIndexOf(".");
    input.setSelectionRange(0, dot > 0 ? dot : defaultValue.length);
  }, [defaultValue]);

  return (
    <input
      ref={ref}
      defaultValue={defaultValue}
      className="h-5 w-full rounded border border-primary bg-background px-1.5 text-xs text-foreground outline-none"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          const value = (e.target as HTMLInputElement).value.trim();
          if (value !== "") onConfirm(value);
        }
        if (e.key === "Escape") onCancel();
      }}
      onBlur={(e) => {
        const value = e.target.value.trim();
        if (value !== "" && value !== defaultValue) {
          onConfirm(value);
        } else {
          onCancel();
        }
      }}
    />
  );
}

type InlineAction =
  | { readonly kind: "rename" }
  | { readonly kind: "new-file" }
  | { readonly kind: "new-folder" };

function parentPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(0, slash);
}

// The row content — shared between file and folder nodes
function NodeRow({
  node,
  depth,
  isDragging,
  isRenaming,
  showOpen,
  onSelect,
  ops,
  dragRef,
  setInlineAction,
  setExpanded,
}: {
  readonly node: FileTreeNode;
  readonly depth: number;
  readonly isDragging: boolean;
  readonly isRenaming: boolean;
  readonly showOpen: boolean;
  readonly onSelect: (path: string) => void;
  readonly ops: FileOps;
  readonly dragRef: (el: HTMLElement | null) => void;
  readonly setInlineAction: (a: InlineAction | undefined) => void;
  readonly setExpanded: (fn: (prev: boolean) => boolean) => void;
}) {
  const indent = depth * 12;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          ref={dragRef}
          role="treeitem"
          tabIndex={0}
          onClick={() => {
            if (node.kind === "dir") {
              setExpanded((prev) => !prev);
            } else {
              onSelect(node.path);
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            if (node.kind === "dir") {
              setExpanded((prev) => !prev);
            } else {
              onSelect(node.path);
            }
          }}
          className={[
            "focus-ring relative flex w-full cursor-default items-center gap-1.5 rounded-sm px-2 py-1 text-left text-xs",
            isDragging
              ? "opacity-40"
              : "text-foreground/80 transition-colors hover:bg-muted",
          ].join(" ")}
          style={{ paddingLeft: `${indent + 4}px` }}
        >
          {node.kind === "dir" ? (
            <>
              <ChevronRight
                className={`size-3 shrink-0 transition-transform ${showOpen ? "rotate-90" : ""}`}
              />
              {showOpen ? (
                <FolderOpen className="size-3.5 shrink-0 text-primary/70" />
              ) : (
                <Folder className="size-3.5 shrink-0 text-primary/70" />
              )}
            </>
          ) : (
            <>
              <span className="size-3 shrink-0" />
              <FileIcon name={node.name} ext={node.ext} />
            </>
          )}
          {isRenaming ? (
            <InlineInput
              defaultValue={node.name}
              onConfirm={async (newName) => {
                await ops.rename(node.path, `${parentPath(node.path)}/${newName}`);
                setInlineAction(undefined);
              }}
              onCancel={() => setInlineAction(undefined)}
            />
          ) : (
            <span className="truncate">{node.name}</span>
          )}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        {node.kind === "dir" ? (
          <>
            <ContextMenuItem onClick={() => { setExpanded(() => true); setInlineAction({ kind: "new-file" }); }}>
              <FilePlus className="size-4" />
              New File
            </ContextMenuItem>
            <ContextMenuItem onClick={() => { setExpanded(() => true); setInlineAction({ kind: "new-folder" }); }}>
              <FolderPlus className="size-4" />
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem onClick={() => setInlineAction({ kind: "rename" })}>
          <Pencil className="size-4" />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(node.path)}>
          <Copy className="size-4" />
          Copy Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => ops.remove(node.path)}>
          <Trash2 className="size-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function FileExplorerNode({ node, depth, onSelect, ops }: FileExplorerNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [inlineAction, setInlineAction] = useState<InlineAction | undefined>(undefined);

  const { ref: dragRef, isDragging } = useDraggable({ id: node.path });

  const isRenaming = inlineAction?.kind === "rename";

  // --- Files: just draggable, no drop zone ---
  if (node.kind === "file") {
    return (
      <NodeRow
        node={node}
        depth={depth}
        isDragging={isDragging}

        isRenaming={isRenaming}
        showOpen={false}
        onSelect={onSelect}
        ops={ops}
        dragRef={dragRef}
        setInlineAction={setInlineAction}
        setExpanded={setExpanded}
      />
    );
  }

  // --- Folders: droppable wrapper around row + children ---
  return (
    <FolderDropZone node={node}>
      {(isDropTarget) => (
        <>
          <NodeRow
            node={node}
            depth={depth}
            isDragging={isDragging}
            isRenaming={isRenaming}
            showOpen={expanded || isDropTarget}
            onSelect={onSelect}
            ops={ops}
            dragRef={dragRef}
            setInlineAction={setInlineAction}
            setExpanded={setExpanded}
          />

          {expanded && inlineAction !== undefined && inlineAction.kind !== "rename" ? (
            <div
              className="flex items-center gap-1.5 px-1.5 py-0.5"
              style={{ paddingLeft: `${(depth + 1) * 12 + 4}px` }}
            >
              <span className="size-3 shrink-0" />
              {inlineAction.kind === "new-folder" ? (
                <Folder className="size-3.5 shrink-0 text-primary/70" />
              ) : (
                <span className="size-3.5 shrink-0" />
              )}
              <InlineInput
                defaultValue=""
                onConfirm={async (name) => {
                  if (inlineAction.kind === "new-file") {
                    await ops.createFile(`${node.path}/${name}`);
                  } else {
                    await ops.createDir(`${node.path}/${name}`);
                  }
                  setInlineAction(undefined);
                }}
                onCancel={() => setInlineAction(undefined)}
              />
            </div>
          ) : null}

          {expanded
            ? node.children.map((child) => (
                <FileExplorerNode
                  key={child.path}
                  node={child}
                  depth={depth + 1}
                  onSelect={onSelect}
                  ops={ops}
                />
              ))
            : null}
        </>
      )}
    </FolderDropZone>
  );
}

// Wraps a folder's entire area (row + children) in a droppable zone.
// Dropping anywhere inside the expanded folder targets THIS folder.
// Nested folders have their own FolderDropZone — innermost wins via dnd-kit collision detection.
function FolderDropZone({
  node,
  children,
}: {
  readonly node: FileTreeNode;
  readonly children: (isDropTarget: boolean) => React.ReactNode;
}) {
  const { ref, isDropTarget } = useDroppable({ id: node.path });

  return (
    <div
      ref={ref}
      className={[
        "rounded-sm transition-colors",
        isDropTarget ? "bg-primary/5" : "",
      ].join(" ")}
    >
      {children(isDropTarget)}
    </div>
  );
}
