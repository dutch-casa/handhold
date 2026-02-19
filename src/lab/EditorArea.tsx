import { Editor } from "@/lab/Editor";
import { EditorTabs } from "@/lab/EditorTabs";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Code } from "lucide-react";
import type { LabEditorSlice } from "@/lab/use-lab";

function extFromPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1);
}

type EditorAreaProps = {
  readonly editor: LabEditorSlice;
  readonly requestClose: (path: string) => void;
};

function EditorBreadcrumbs({ segments }: { readonly segments: readonly string[] }) {
  if (segments.length === 0) return null;

  let acc = "";
  return (
    <div className="flex items-center border-b border-border bg-background px-3 py-1">
      <Breadcrumb>
        <BreadcrumbList>
          {segments.map((segment, idx) => {
            acc = acc ? `${acc}/${segment}` : segment;
            const isLast = idx === segments.length - 1;
            return (
            <BreadcrumbItem key={acc}>
              {idx > 0 ? <BreadcrumbSeparator /> : null}
              {isLast ? (
                <BreadcrumbPage className="text-xs">{segment}</BreadcrumbPage>
              ) : (
                <span className="text-xs text-muted-foreground">{segment}</span>
              )}
            </BreadcrumbItem>
          )})}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export function EditorArea({ editor, requestClose }: EditorAreaProps) {
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
      />
      <EditorBreadcrumbs segments={breadcrumbs} />
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
