import { ChevronLeft, ChevronRight, CircleAlert, TriangleAlert } from "lucide-react";
import { useEditorCursorStore } from "@/lab/editor-cursor-store";
import { useSettingsStore } from "@/lab/settings-store";
import { useDiagnosticsStore } from "@/lab/diagnostics-store";
import { useVimStatusStore } from "@/lab/vim-status-store";
import type { LabStatusSlice } from "@/lab/use-lab";
import type { CourseNav } from "@/course/use-course";

// File extension → human-readable language label
const EXT_TO_LABEL: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript JSX",
  js: "JavaScript",
  jsx: "JavaScript JSX",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  rs: "Rust",
  java: "Java",
  sql: "SQL",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  html: "HTML",
  css: "CSS",
  c: "C",
  cpp: "C++",
  h: "C",
  hpp: "C++",
  md: "Markdown",
};

function extFromPath(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1);
}

// Lifecycle kind → human-readable label
const LIFECYCLE_LABEL: Record<string, string> = {
  uninitialized: "Initializing",
  provisioning: "Provisioning",
  ready: "Ready",
  failed: "Error",
  "tearing-down": "Shutting down",
};

// Lifecycle kind → status dot color
const LIFECYCLE_DOT: Record<string, string> = {
  uninitialized: "bg-muted-foreground",
  provisioning: "bg-yellow-400",
  ready: "bg-green-400",
  failed: "bg-red-400",
  "tearing-down": "bg-yellow-400",
};

type StatusBarProps = {
  readonly status: LabStatusSlice;
  readonly nav?: CourseNav | undefined;
  readonly activePath?: string | undefined;
};

export function StatusBar({ status, nav, activePath }: StatusBarProps) {
  const label = LIFECYCLE_LABEL[status.lifecycle.kind] ?? "Unknown";
  const dot = LIFECYCLE_DOT[status.lifecycle.kind] ?? "bg-muted-foreground";

  const { line, col } = useEditorCursorStore();
  const tabSize = useSettingsStore((s) => s.editor.tabSize);
  const vimMode = useSettingsStore((s) => s.editor.vimMode);
  const vimStatus = useVimStatusStore((s) => s.mode);
  const errorCount = useDiagnosticsStore((s) => s.errorCount);
  const warningCount = useDiagnosticsStore((s) => s.warningCount);

  const ext = activePath !== undefined ? extFromPath(activePath) : undefined;
  const langLabel = ext !== undefined ? EXT_TO_LABEL[ext] : undefined;

  return (
    <div className="ide-status-bar">
      {nav !== undefined ? (
        <div className="flex items-center gap-1">
          <button
            onClick={nav.prev}
            disabled={!nav.canPrev}
            className="focus-ring flex items-center rounded p-0.5 hover:bg-muted disabled:opacity-30"
            aria-label="Previous step"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <span>
            {nav.progress.current} / {nav.progress.total}
          </span>
          <button
            onClick={nav.next}
            disabled={!nav.canNext}
            className="focus-ring flex items-center rounded p-0.5 hover:bg-muted disabled:opacity-30"
            aria-label="Next step"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <span className="ml-1 text-muted-foreground">{nav.step.title}</span>
        </div>
      ) : (
        <span>{status.title}</span>
      )}

      <div className="flex items-center gap-3">
        {errorCount > 0 || warningCount > 0 ? (
          <span className="flex items-center gap-2">
            {errorCount > 0 ? (
              <span className="flex items-center gap-1 text-red-400">
                <CircleAlert className="size-3.5" />
                {errorCount}
              </span>
            ) : null}
            {warningCount > 0 ? (
              <span className="flex items-center gap-1 text-yellow-400">
                <TriangleAlert className="size-3.5" />
                {warningCount}
              </span>
            ) : null}
          </span>
        ) : null}
        {vimMode && vimStatus !== "" ? (
          <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-primary">
            {vimStatus}
          </span>
        ) : null}
        {activePath !== undefined ? (
          <>
            <span className="tabular-nums">Ln {line}, Col {col}</span>
            {langLabel !== undefined ? <span>{langLabel}</span> : null}
            <span>Spaces: {tabSize}</span>
          </>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className={`size-1.5 rounded-full ${dot}`} />
          {label}
        </span>
      </div>
    </div>
  );
}
