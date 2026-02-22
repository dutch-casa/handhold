import { createContext, use, type ReactNode } from "react";

// Shared context for the course editor — provides course identity and
// step navigation without prop drilling through the layout tree.

type EditorContextValue = {
  readonly courseId: string;
  readonly courseName: string;
  readonly stepName: string;
  readonly stepIndex: number;
  readonly stepCount: number;
};

const EditorCtx = createContext<EditorContextValue | null>(null);

type EditorProviderProps = EditorContextValue & {
  readonly children: ReactNode;
};

export function EditorProvider({
  children,
  courseId,
  courseName,
  stepName,
  stepIndex,
  stepCount,
}: EditorProviderProps) {
  return (
    <EditorCtx
      value={{ courseId, courseName, stepName, stepIndex, stepCount }}
    >
      {children}
    </EditorCtx>
  );
}

export function useEditorContext(): EditorContextValue {
  const ctx = use(EditorCtx);
  if (!ctx) throw new Error("useEditorContext must be used within EditorProvider");
  return ctx;
}
