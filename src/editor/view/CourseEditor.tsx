import { type ReactNode } from "react";
import { Layout } from "@/editor/view/Layout";
import { Toolbar } from "@/editor/view/Toolbar";
import { EditorProvider } from "@/editor/view/EditorContext";
import { Sidebar } from "@/editor/view/sidebar/Sidebar";

// ── CourseEditor ──────────────────────────────────────────────────
// Top-level shell for the course editor. Wires the responsive Layout
// and Toolbar with EditorProvider context. Content components are
// injected via props — CourseEditor owns chrome, not content.

type CourseEditorProps = {
  readonly courseId: string;
  readonly courseName: string;
  readonly stepName: string;
  readonly stepIndex: number;
  readonly stepCount: number;
  readonly sidebar?: ReactNode;
  readonly canvas?: ReactNode;
  readonly panel?: ReactNode;
  readonly bottomBar?: ReactNode;
};

export function CourseEditor({
  courseId,
  courseName,
  stepName,
  stepIndex,
  stepCount,
  sidebar,
  canvas,
  panel,
  bottomBar,
}: CourseEditorProps) {
  return (
    <EditorProvider
      courseId={courseId}
      courseName={courseName}
      stepName={stepName}
      stepIndex={stepIndex}
      stepCount={stepCount}
    >
      <div className="flex h-screen flex-col">
        <Toolbar>
          <Toolbar.Breadcrumb />
          <Toolbar.Spacer />
          <Toolbar.ViewToggle />
          <Toolbar.UndoRedo />
          <Toolbar.PreviewButton />
        </Toolbar>

        <div className="flex-1 min-h-0">
          <Layout>
            <Layout.Sidebar>
              {sidebar ?? <DefaultSidebar />}
            </Layout.Sidebar>
            <Layout.Canvas>
              {canvas ?? <DefaultCanvas />}
            </Layout.Canvas>
            <Layout.Panel>
              {panel ?? <DefaultPanel />}
            </Layout.Panel>
            <Layout.BottomBar>
              {bottomBar ?? <DefaultBottomBar />}
            </Layout.BottomBar>
          </Layout>
        </div>
      </div>
    </EditorProvider>
  );
}

function DefaultSidebar() {
  return <Sidebar />;
}

function DefaultCanvas() {
  return (
    <div className="ide-empty-state h-full">
      <span className="text-ide-sm text-muted-foreground">Canvas</span>
    </div>
  );
}

function DefaultPanel() {
  return (
    <div className="ide-empty-state h-full">
      <span className="text-ide-xs text-muted-foreground">Properties</span>
    </div>
  );
}

function DefaultBottomBar() {
  return (
    <div className="ide-empty-state h-full">
      <span className="text-ide-xs text-muted-foreground">Preview</span>
    </div>
  );
}
