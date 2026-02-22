// LabScaffoldTree — file tree showing scaffold directory structure.
// Renders a placeholder tree from scaffoldPath. Context menu actions
// (new file, new dir, rename, delete) log to console for now.

import { useCallback, useState } from "react";
import { useLabEditor } from "@/editor/viewmodel/lab-editor-store";
import { useCourseEditorStore } from "@/editor/viewmodel/course-editor-store";
import type { EditableLab } from "@/editor/model/types";

// ── Helpers ────────────────────────────────────────────────────

function findLabForStep(stepId: string): EditableLab | undefined {
  const course = useCourseEditorStore.getState().course;
  if (!course) return undefined;
  const step = course.steps.find((s) => s.id === stepId);
  if (!step || step.kind !== "lab") return undefined;
  return step.lab;
}

// ── Tree node model ───────────────────────────────────────────

type TreeNode = {
  readonly name: string;
  readonly path: string;
  readonly kind: "file" | "dir";
  readonly children: readonly TreeNode[];
};

// Build a placeholder tree from a scaffold path. Returns a default
// project structure to give the UI shape before actual FS integration.
function buildPlaceholderTree(scaffoldPath: string): TreeNode {
  const root = scaffoldPath || "scaffold";
  return {
    name: root.split("/").pop() ?? root,
    path: root,
    kind: "dir",
    children: [
      {
        name: "src",
        path: `${root}/src`,
        kind: "dir",
        children: [
          { name: "index.ts", path: `${root}/src/index.ts`, kind: "file", children: [] },
          { name: "utils.ts", path: `${root}/src/utils.ts`, kind: "file", children: [] },
        ],
      },
      {
        name: "tests",
        path: `${root}/tests`,
        kind: "dir",
        children: [
          { name: "index.test.ts", path: `${root}/tests/index.test.ts`, kind: "file", children: [] },
        ],
      },
      { name: "package.json", path: `${root}/package.json`, kind: "file", children: [] },
      { name: "tsconfig.json", path: `${root}/tsconfig.json`, kind: "file", children: [] },
      { name: "README.md", path: `${root}/README.md`, kind: "file", children: [] },
    ],
  };
}

// ── Context menu ──────────────────────────────────────────────

type ContextMenuState =
  | { readonly kind: "closed" }
  | { readonly kind: "open"; readonly x: number; readonly y: number; readonly node: TreeNode };

// ── TreeNodeRow ───────────────────────────────────────────────

type TreeNodeRowProps = {
  readonly node: TreeNode;
  readonly depth: number;
  readonly expanded: ReadonlySet<string>;
  readonly onToggle: (path: string) => void;
  readonly onClick: (node: TreeNode) => void;
  readonly onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
};

function TreeNodeRow({ node, depth, expanded, onToggle, onClick, onContextMenu }: TreeNodeRowProps) {
  const isDir = node.kind === "dir";
  const isExpanded = expanded.has(node.path);
  const indent = depth * 16;

  return (
    <>
      <button
        type="button"
        className="focus-ring tap-target group flex min-h-[44px] w-full items-center gap-sp-1 px-sp-2 text-ide-xs text-foreground hover:bg-accent"
        style={{ paddingLeft: `${indent + 8}px` }}
        aria-label={isDir ? `${isExpanded ? "Collapse" : "Expand"} ${node.name}` : node.name}
        onClick={() => {
          if (isDir) {
            onToggle(node.path);
            return;
          }
          onClick(node);
        }}
        onContextMenu={(e) => { onContextMenu(e, node); }}
      >
        {/* Chevron for directories */}
        {isDir ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground"
            style={{ transform: isExpanded ? "rotate(90deg)" : undefined }}
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <span className="w-[14px] shrink-0" aria-hidden="true" />
        )}

        {/* Icon */}
        {isDir ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-primary/70"
            aria-hidden="true"
          >
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-muted-foreground"
            aria-hidden="true"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        )}

        <span className="truncate">{node.name}</span>
      </button>

      {/* Children */}
      {isDir && isExpanded && node.children.map((child) => (
        <TreeNodeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onClick={onClick}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

// ── LabScaffoldTree ───────────────────────────────────────────

type LabScaffoldTreeProps = {
  readonly stepId: string;
};

export function LabScaffoldTree({ stepId }: LabScaffoldTreeProps) {
  const lab = findLabForStep(stepId);
  if (!lab) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground">Lab not found</span>
      </div>
    );
  }

  return <ScaffoldTreePane lab={lab} />;
}

function ScaffoldTreePane({ lab }: { readonly lab: EditableLab }) {
  const store = useLabEditor(lab);
  const tree = buildPlaceholderTree(store.lab.scaffoldPath);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set([tree.path]));
  const [menu, setMenu] = useState<ContextMenuState>({ kind: "closed" });

  const handleToggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleClick = useCallback((node: TreeNode) => {
    console.log("[LabScaffoldTree] file clicked:", node.path);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    setMenu({ kind: "open", x: e.clientX, y: e.clientY, node });
  }, []);

  const closeMenu = useCallback(() => {
    setMenu({ kind: "closed" });
  }, []);

  const handleMenuAction = useCallback((action: string, node: TreeNode) => {
    console.log(`[LabScaffoldTree] ${action}:`, node.path);
    setMenu({ kind: "closed" });
  }, []);

  return (
    <div className="flex h-full flex-col" onClick={closeMenu}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-sp-3 py-sp-2">
        <h2 className="text-ide-sm font-semibold text-foreground">Scaffold Files</h2>
        <div className="flex gap-sp-1">
          <button
            type="button"
            className="tap-target focus-ring min-h-[44px] min-w-[44px] rounded-sm px-sp-2 text-ide-2xs text-muted-foreground hover:text-foreground"
            aria-label="New file"
            onClick={() => { console.log("[LabScaffoldTree] new file"); }}
          >
            + File
          </button>
          <button
            type="button"
            className="tap-target focus-ring min-h-[44px] min-w-[44px] rounded-sm px-sp-2 text-ide-2xs text-muted-foreground hover:text-foreground"
            aria-label="New directory"
            onClick={() => { console.log("[LabScaffoldTree] new dir"); }}
          >
            + Dir
          </button>
        </div>
      </div>

      {/* Scaffold path input */}
      <div className="flex items-center gap-sp-2 border-b border-border px-sp-3 py-sp-1">
        <span className="text-ide-2xs text-muted-foreground">Path:</span>
        <input
          type="text"
          className="focus-ring flex-1 rounded-sm border border-border bg-secondary px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground placeholder:text-muted-foreground/50"
          placeholder="scaffold/"
          value={store.lab.scaffoldPath}
          onChange={(e) => { store.updateScaffoldPath(e.target.value); }}
          aria-label="Scaffold path"
        />
      </div>

      {/* Tree */}
      <div className="ide-scrollbar flex-1 overflow-y-auto py-sp-1">
        <TreeNodeRow
          node={tree}
          depth={0}
          expanded={expanded}
          onToggle={handleToggle}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        />
      </div>

      {/* Context menu */}
      {menu.kind === "open" && (
        <div
          className="fixed z-50 min-w-[140px] rounded-md border border-border bg-popover p-sp-1 shadow-elevation-3"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
          aria-label="Scaffold file actions"
        >
          <button
            type="button"
            role="menuitem"
            className="focus-ring flex min-h-[44px] w-full items-center rounded-sm px-sp-3 text-ide-xs text-foreground hover:bg-accent"
            onClick={() => { handleMenuAction("new-file", menu.node); }}
          >
            New File
          </button>
          <button
            type="button"
            role="menuitem"
            className="focus-ring flex min-h-[44px] w-full items-center rounded-sm px-sp-3 text-ide-xs text-foreground hover:bg-accent"
            onClick={() => { handleMenuAction("new-dir", menu.node); }}
          >
            New Directory
          </button>
          <button
            type="button"
            role="menuitem"
            className="focus-ring flex min-h-[44px] w-full items-center rounded-sm px-sp-3 text-ide-xs text-foreground hover:bg-accent"
            onClick={() => { handleMenuAction("rename", menu.node); }}
          >
            Rename
          </button>
          <div className="my-sp-1 h-px bg-border" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="focus-ring flex min-h-[44px] w-full items-center rounded-sm px-sp-3 text-ide-xs text-destructive hover:bg-accent"
            onClick={() => { handleMenuAction("delete", menu.node); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
