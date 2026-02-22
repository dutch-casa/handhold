// Root compound component for the course editor.
// Wraps children in EditorProvider. Placeholder slots for future panels.

import type { ReactNode } from "react";
import { EditorProvider } from "@/editor/view/EditorContext";

type CourseEditorProps = {
  readonly courseId: string;
  readonly children?: ReactNode | undefined;
};

function CourseEditorRoot({ courseId, children }: CourseEditorProps) {
  return (
    <EditorProvider courseId={courseId}>
      {children ?? <DefaultLayout />}
    </EditorProvider>
  );
}

// Placeholder slots — div shells with semantic classNames for future implementation.

function Toolbar() {
  return <div className="editor-toolbar" />;
}

function Layout({ children }: { readonly children?: ReactNode | undefined }) {
  return <div className="editor-layout flex h-full w-full">{children}</div>;
}

function Sidebar() {
  return <div className="editor-sidebar" />;
}

function Canvas() {
  return <div className="editor-canvas flex-1" />;
}

function Panel() {
  return <div className="editor-panel" />;
}

function BottomBar() {
  return <div className="editor-bottom-bar" />;
}

function DefaultLayout() {
  return (
    <div className="flex h-full w-full flex-col">
      <Toolbar />
      <Layout>
        <Sidebar />
        <Canvas />
        <Panel />
      </Layout>
      <BottomBar />
    </div>
  );
}

export const CourseEditor = Object.assign(CourseEditorRoot, {
  Toolbar,
  Layout,
  Sidebar,
  Canvas,
  Panel,
  BottomBar,
});
