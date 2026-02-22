import type { ReactNode } from "react";

export type CourseEditorProps = {
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

/** Placeholder shell — real implementation lands in later tasks. */
export function CourseEditor({ courseId, courseName }: CourseEditorProps) {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-2">
        <h1 className="text-lg font-semibold">Course Editor</h1>
        <p className="text-sm text-muted-foreground">
          {courseName} ({courseId})
        </p>
      </div>
    </div>
  );
}
