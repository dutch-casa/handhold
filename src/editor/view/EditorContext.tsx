// Editor context: exposes stores to the component tree.
// Components consume via use() (React 19), never useContext().

import { createContext, use, type ReactNode } from "react";
import { useLayoutStore, type LayoutStore } from "@/editor/viewmodel/layout-store";

type EditorContextValue = {
  readonly courseId: string;
  readonly layoutStore: typeof useLayoutStore;
};

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const ctx = use(EditorContext);
  if (!ctx) {
    throw new Error("useEditorContext must be used within <EditorProvider>");
  }
  return ctx;
}

// Narrow selectors for common access patterns
export function useEditorCourseId(): string {
  return useEditorContext().courseId;
}

export function useEditorLayoutStore(): LayoutStore {
  return useEditorContext().layoutStore();
}

type EditorProviderProps = {
  readonly courseId: string;
  readonly children: ReactNode;
};

export function EditorProvider({ courseId, children }: EditorProviderProps) {
  const value: EditorContextValue = {
    courseId,
    layoutStore: useLayoutStore,
  };

  return <EditorContext value={value}>{children}</EditorContext>;
}
