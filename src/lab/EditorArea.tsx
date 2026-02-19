import { Editor } from "@/lab/Editor";
import { EditorTabs } from "@/lab/EditorTabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Code, Folder, ChevronRight } from "lucide-react";
import { FileIcon } from "@/lab/file-icons";
import type { LabEditorSlice } from "@/lab/use-lab";
import type { FileTreeNode } from "@/types/lab";

function extFromPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1);
}

type EditorAreaProps = {
  readonly editor: LabEditorSlice;
  readonly requestClose: (path: string) => void;
  readonly tree: readonly FileTreeNode[];
  readonly rootPath: string;
};

function findChildrenAtPath(
  tree: readonly FileTreeNode[],
  pathSegments: readonly string[],
  rootPath: string,
): readonly FileTreeNode[] {
  let current: readonly FileTreeNode[] = tree;
  let builtPath = rootPath;

  for (const segment of pathSegments) {
    builtPath = `${builtPath}/${segment}`;
    const dir = current.find((n) => n.kind === "dir" && n.path === builtPath);
    if (dir === undefined || dir.kind !== "dir") return [];
    current = dir.children;
  }
  return current;
}

function EditorBreadcrumbs({
  segments,
  tree,
  rootPath,
  onFileSelect,
}: {
  readonly segments: readonly string[];
  readonly tree: readonly FileTreeNode[];
  readonly rootPath: string;
  readonly onFileSelect: (path: string) => void;
}) {
  if (segments.length === 0) return null;

  return (
    <div className="flex items-center border-b border-border bg-background px-3 py-1">
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((segment, idx) => {
            const isLast = idx === segments.length - 1;
            const parentSegments = segments.slice(0, idx);
            const siblings = findChildrenAtPath(tree, parentSegments, rootPath);
            const sortedSiblings = [...siblings].sort((a, b) => {
              if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
              return a.name.localeCompare(b.name);
            });

            return (
              <BreadcrumbItem key={segments.slice(0, idx + 1).join("/")}>
                {idx > 0 ? <BreadcrumbSeparator><ChevronRight className="size-3" /></BreadcrumbSeparator> : null}
                {isLast ? (
                  <BreadcrumbPage className="text-xs">{segment}</BreadcrumbPage>
                ) : sortedSiblings.length > 0 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="text-xs text-muted-foreground transition-colors hover:text-foreground">
                      {segment}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
                      {sortedSiblings.map((node) => (
                        <DropdownMenuItem
                          key={node.path}
                          onSelect={() => {
                            if (node.kind === "file") onFileSelect(node.path);
                          }}
                          className="gap-2 text-xs"
                        >
                          {node.kind === "dir" ? (
                            <Folder className="size-3.5 text-primary/70" />
                          ) : (
                            <FileIcon name={node.name} ext={node.kind === "file" ? node.ext : ""} />
                          )}
                          <span className={node.name === segment ? "font-medium" : ""}>
                            {node.name}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="text-xs text-muted-foreground">{segment}</span>
                )}
              </BreadcrumbItem>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export function EditorArea({ editor, requestClose, tree, rootPath }: EditorAreaProps) {
  const { tabs, activePath, content, contentLoading, saveContent, markDirty, breadcrumbs, gitChanges } = editor;

  return (
    <div className="flex h-full flex-col">
      <EditorTabs
        tabs={tabs}
        onSelect={editor.select}
        onClose={requestClose}
        onCloseOthers={editor.closeOthers}
        onCloseAll={editor.closeAll}
        onCloseSaved={editor.closeSaved}
        onReorder={editor.reorderTabs}
      />
      <EditorBreadcrumbs
        segments={breadcrumbs}
        tree={tree}
        rootPath={rootPath}
        onFileSelect={editor.open}
      />
      <div className="flex-1 overflow-hidden">
        {activePath !== undefined && content !== undefined && !contentLoading ? (
          <Editor
            key={activePath}
            filePath={activePath}
            content={content}
            ext={extFromPath(activePath)}
            gitChanges={gitChanges}
            onSave={saveContent}
            onChange={markDirty}
            onOpenFile={editor.openAt}
            fontSize={editor.fontSize}
            tabSize={editor.tabSize}
            onViewCreated={editor.setEditorInstance}
            onViewDestroyed={() => editor.setEditorInstance(null)}
          />
        ) : activePath !== undefined && contentLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : (
          <div className="ide-empty-state">
            <Code className="size-8 opacity-50" />
            <span className="text-sm">Select a file to edit</span>
          </div>
        )}
      </div>
    </div>
  );
}
