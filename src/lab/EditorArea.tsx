import { Editor } from "@/lab/Editor";
import { EditorTabs } from "@/lab/EditorTabs";
import { Group, Panel, Separator } from "react-resizable-panels";
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
import type { editor as monacoEditor } from "monaco-editor";
import type { LabEditorSlice } from "@/lab/use-lab";
import type { FileTreeNode } from "@/types/lab";
import type { LineChange } from "@/lab/tauri/git";

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

// --- Breadcrumbs ---

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

// --- Single editor pane (breadcrumbs + Monaco + empty state) ---

type EditorPaneProps = {
  readonly activePath: string | undefined;
  readonly content: string | undefined;
  readonly contentLoading: boolean;
  readonly breadcrumbs: readonly string[];
  readonly gitChanges: readonly LineChange[];
  readonly readOnly: boolean;
  readonly tree: readonly FileTreeNode[];
  readonly rootPath: string;
  readonly fontSize: number;
  readonly tabSize: number;
  readonly isFocused: boolean;
  readonly onSave: (path: string, content: string) => Promise<void>;
  readonly onChange: (path: string, content: string) => void;
  readonly onOpenFile: (path: string, line: number, column: number) => void;
  readonly onViewCreated: (path: string, editor: monacoEditor.IStandaloneCodeEditor) => void;
  readonly onViewDestroyed: (path: string) => void;
  readonly onFocus: () => void;
};

function EditorPane({
  activePath,
  content,
  contentLoading,
  breadcrumbs,
  gitChanges,
  readOnly,
  tree,
  rootPath,
  fontSize,
  tabSize,
  isFocused,
  onSave,
  onChange,
  onOpenFile,
  onViewCreated,
  onViewDestroyed,
  onFocus,
}: EditorPaneProps) {
  return (
    <div
      className={`flex h-full flex-col ${isFocused ? "border-t-2 border-primary/40" : "border-t-2 border-transparent"}`}
      onClick={onFocus}
    >
      <EditorBreadcrumbs
        segments={breadcrumbs}
        tree={tree}
        rootPath={rootPath}
        onFileSelect={(path) => {
          onFocus();
          onOpenFile(path, 1, 1);
        }}
      />
      <div className="flex-1 overflow-hidden">
        {activePath !== undefined && content !== undefined && !contentLoading ? (
          <Editor
            key={activePath}
            filePath={activePath}
            content={content}
            ext={extFromPath(activePath)}
            gitChanges={gitChanges}
            readOnly={readOnly}
            onSave={(text) => onSave(activePath, text)}
            onChange={(text) => onChange(activePath, text)}
            onOpenFile={onOpenFile}
            fontSize={fontSize}
            tabSize={tabSize}
            onViewCreated={(ed) => onViewCreated(activePath, ed)}
            onViewDestroyed={() => onViewDestroyed(activePath)}
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

// --- Resize handle for split panes ---

function SplitResizeHandle() {
  return (
    <Separator
      className="group relative w-px bg-border transition-colors data-[active]:bg-primary"
    >
      <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize touch-none" />
    </Separator>
  );
}

// --- Main editor area ---

export function EditorArea({ editor, requestClose, tree, rootPath }: EditorAreaProps) {
  const isSplit = editor.rightActivePath !== undefined;
  const leftReadOnly = editor.activePath !== undefined && editor.solutionOpenPaths.has(editor.activePath);
  const rightReadOnly = editor.rightActivePath !== undefined && editor.solutionOpenPaths.has(editor.rightActivePath);

  const paneProps = {
    tree,
    rootPath,
    fontSize: editor.fontSize,
    tabSize: editor.tabSize,
    onSave: editor.saveContent,
    onChange: editor.markDirty,
    onOpenFile: editor.openAt,
    onViewCreated: (path: string, ed: monacoEditor.IStandaloneCodeEditor) => editor.setEditorInstance(path, ed),
    onViewDestroyed: (path: string) => editor.setEditorInstance(path, null),
  } as const;

  return (
    <div className="flex h-full flex-col">
      <EditorTabs
        tabs={editor.tabs}
        onSelect={editor.select}
        onClose={requestClose}
        onCloseOthers={editor.closeOthers}
        onCloseAll={editor.closeAll}
        onCloseSaved={editor.closeSaved}
        onReorder={editor.reorderTabs}
        onSplitRight={editor.splitRight}
        isSplit={isSplit}
      />
      <div className="flex-1 overflow-hidden">
        {isSplit ? (
          <Group orientation="horizontal" style={{ height: "100%" }}>
            <Panel defaultSize={50} minSize={20}>
              <EditorPane
                activePath={editor.activePath}
                content={editor.content}
                contentLoading={editor.contentLoading}
                breadcrumbs={editor.breadcrumbs}
                gitChanges={editor.gitChanges}
                readOnly={leftReadOnly}
                isFocused={editor.focusedPane === "left"}
                onFocus={() => editor.setFocusedPane("left")}
                {...paneProps}
              />
            </Panel>
            <SplitResizeHandle />
            <Panel defaultSize={50} minSize={20}>
              <EditorPane
                activePath={editor.rightActivePath}
                content={editor.rightContent}
                contentLoading={editor.rightContentLoading}
                breadcrumbs={editor.rightBreadcrumbs}
                gitChanges={editor.rightGitChanges}
                readOnly={rightReadOnly}
                isFocused={editor.focusedPane === "right"}
                onFocus={() => editor.setFocusedPane("right")}
                {...paneProps}
              />
            </Panel>
          </Group>
        ) : (
          <EditorPane
            activePath={editor.activePath}
            content={editor.content}
            contentLoading={editor.contentLoading}
            breadcrumbs={editor.breadcrumbs}
            gitChanges={editor.gitChanges}
            readOnly={leftReadOnly}
            isFocused
            onFocus={() => {}}
            {...paneProps}
          />
        )}
      </div>
    </div>
  );
}
