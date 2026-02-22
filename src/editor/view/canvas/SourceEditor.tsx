// Source editor — raw markdown editing mode for a lesson step.
// Renders serializeLesson() output in a monospace textarea with line numbers.
// "Sync" button round-trips: markdown → parseLesson → deserializeLesson → store update.

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useCourseEditorStore } from "@/editor/viewmodel/course-editor-store";
import { serializeLesson } from "@/editor/model/serialize";
import { parseLesson } from "@/parser/parse-lesson";
import { deserializeLesson } from "@/editor/model/deserialize";
import type { EditableStep, EditableCourseStep } from "@/editor/model/types";

// --- Sync status typestate ---

type SyncStatus =
  | { readonly kind: "in-sync" }
  | { readonly kind: "modified" }
  | { readonly kind: "error"; readonly message: string };

// --- Resolve lesson steps from course by stepId ---

function findLessonByStepId(
  steps: readonly EditableCourseStep[],
  stepId: string,
): { lesson: EditableCourseStep & { readonly kind: "lesson" }; index: number } | undefined {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    if (step.id === stepId && step.kind === "lesson") {
      return { lesson: step, index: i };
    }
  }
  return undefined;
}

function serializeFromLesson(
  lesson: EditableCourseStep & { readonly kind: "lesson" },
): string {
  return serializeLesson(lesson.title, lesson.steps);
}

// --- Line number gutter ---

function LineNumbers({ count }: { readonly count: number }) {
  const lines = useMemo(() => {
    const result: string[] = [];
    for (let i = 1; i <= count; i++) {
      result.push(String(i));
    }
    return result;
  }, [count]);

  return (
    <div
      className="select-none border-r border-border pr-sp-2 text-right font-mono text-ide-2xs text-muted-foreground/40 leading-[1.5rem]"
      aria-hidden="true"
    >
      {lines.map((n) => (
        <div key={n}>{n}</div>
      ))}
    </div>
  );
}

// --- Status badge ---

function StatusBadge({ status }: { readonly status: SyncStatus }) {
  switch (status.kind) {
    case "in-sync":
      return (
        <span className="inline-flex items-center gap-sp-1 rounded-md bg-green-500/10 px-sp-2 py-sp-0.5 font-mono text-ide-2xs text-green-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
          In sync
        </span>
      );
    case "modified":
      return (
        <span className="inline-flex items-center gap-sp-1 rounded-md bg-yellow-500/10 px-sp-2 py-sp-0.5 font-mono text-ide-2xs text-yellow-400">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-400" />
          Modified
        </span>
      );
    case "error":
      return (
        <span className="inline-flex items-center gap-sp-1 rounded-md bg-red-500/10 px-sp-2 py-sp-0.5 font-mono text-ide-2xs text-red-400" title={status.message}>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
          Parse error
        </span>
      );
  }
}

// --- Source editor component ---

export function SourceEditor({ stepId }: { readonly stepId: string }) {
  const course = useCourseEditorStore((s) => s.course);

  if (!course) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground/50">No course loaded</span>
      </div>
    );
  }

  const found = findLessonByStepId(course.steps, stepId);
  if (!found) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground/50">
          Step not found or not a lesson
        </span>
      </div>
    );
  }

  return <SourceEditorInner lesson={found.lesson} />;
}

// --- Inner component with the actual editor logic ---

function SourceEditorInner({
  lesson,
}: {
  readonly lesson: EditableCourseStep & { readonly kind: "lesson" };
}) {
  const serialized = useMemo(() => serializeFromLesson(lesson), [lesson]);
  const [source, setSource] = useState(serialized);
  const [status, setStatus] = useState<SyncStatus>({ kind: "in-sync" });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-sync when external lesson changes (visual edits reflected here).
  const prevSerializedRef = useRef(serialized);
  useEffect(() => {
    if (prevSerializedRef.current !== serialized && status.kind === "in-sync") {
      setSource(serialized);
    }
    prevSerializedRef.current = serialized;
  }, [serialized, status.kind]);

  const lineCount = useMemo(() => {
    const count = source.split("\n").length;
    return Math.max(count, 1);
  }, [source]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setSource(e.target.value);
      setStatus({ kind: "modified" });
    },
    [],
  );

  const handleSync = useCallback(() => {
    try {
      const parsed = parseLesson(source);
      const steps: EditableStep[] = deserializeLesson(parsed);

      // Apply: replace the lesson's steps and title in-place.
      lesson.title = parsed.title;
      lesson.steps.length = 0;
      for (const step of steps) {
        lesson.steps.push(step);
      }

      // Re-serialize to get the canonical form after round-trip.
      const canonical = serializeFromLesson(lesson);
      setSource(canonical);
      setStatus({ kind: "in-sync" });

      // Force Zustand re-render by touching course reference.
      const store = useCourseEditorStore.getState();
      if (store.course) {
        useCourseEditorStore.setState({ course: { ...store.course } });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown parse error";
      setStatus({ kind: "error", message });
    }
  }, [source, lesson]);

  const handleReset = useCallback(() => {
    const fresh = serializeFromLesson(lesson);
    setSource(fresh);
    setStatus({ kind: "in-sync" });
  }, [lesson]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-sp-2 border-b border-border px-sp-3 py-sp-1.5">
        <StatusBadge status={status} />

        <div className="flex-1" />

        {status.kind !== "in-sync" && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md px-sp-2 py-sp-0.5 font-mono text-ide-2xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}

        <button
          type="button"
          onClick={handleSync}
          disabled={status.kind === "in-sync"}
          className="rounded-md bg-primary px-sp-3 py-sp-0.5 font-mono text-ide-2xs text-primary-foreground hover:bg-primary/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Sync
        </button>
      </div>

      {/* Error detail */}
      {status.kind === "error" && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-sp-3 py-sp-1.5">
          <pre className="whitespace-pre-wrap font-mono text-ide-2xs text-red-400">
            {status.message}
          </pre>
        </div>
      )}

      {/* Editor area: gutter + textarea */}
      <div className="flex flex-1 min-h-0 overflow-auto">
        <div className="shrink-0 py-sp-2 pl-sp-2">
          <LineNumbers count={lineCount} />
        </div>
        <textarea
          ref={textareaRef}
          value={source}
          onChange={handleChange}
          spellCheck={false}
          className="flex-1 resize-none bg-transparent p-sp-2 font-mono text-ide-xs text-foreground leading-[1.5rem] outline-none"
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
}
