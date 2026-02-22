import { type ReactNode } from "react";
import { useEditorContext } from "@/editor/view/EditorContext";
import { useLayoutStore } from "@/editor/viewmodel/layout-store";
import { useCourseEditorStore, useEditorCanUndo, useEditorCanRedo } from "@/editor/viewmodel/course-editor-store";

// ── Toolbar slots ─────────────────────────────────────────────────

function Breadcrumb() {
  const { courseName, stepName } = useEditorContext();

  return (
    <nav className="flex items-center gap-1.5 text-ide-sm text-muted-foreground min-w-0" aria-label="Breadcrumb">
      <span className="truncate max-w-[200px]">{courseName}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 opacity-50">
        <path d="M4.5 2.5L7.5 6L4.5 9.5" />
      </svg>
      <span className="truncate max-w-[240px] text-foreground">{stepName}</span>
    </nav>
  );
}

function Spacer() {
  return <div className="flex-1" />;
}

function ViewToggle() {
  const viewMode = useCourseEditorStore((s) => s.viewMode);
  const toggleViewMode = useCourseEditorStore((s) => s.toggleViewMode);

  return (
    <div className="flex items-center rounded-md border border-border bg-muted/50 p-0.5" role="radiogroup" aria-label="View mode">
      <button
        role="radio"
        aria-checked={viewMode === "visual"}
        onClick={() => { if (viewMode !== "visual") toggleViewMode(); }}
        className={`
          flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-ide-xs font-medium transition-colors duration-fast
          focus-ring
          ${viewMode === "visual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}
        `}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <rect x="2" y="2" width="10" height="10" rx="1.5" />
          <path d="M2 5.5h10" />
          <path d="M5.5 5.5V12" />
        </svg>
        Visual
      </button>
      <button
        role="radio"
        aria-checked={viewMode === "source"}
        onClick={() => { if (viewMode !== "source") toggleViewMode(); }}
        className={`
          flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-ide-xs font-medium transition-colors duration-fast
          focus-ring
          ${viewMode === "source" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}
        `}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M5 3.5L2 7l3 3.5" />
          <path d="M9 3.5L12 7l-3 3.5" />
        </svg>
        Source
      </button>
    </div>
  );
}

function UndoRedo() {
  const canUndo = useEditorCanUndo();
  const canRedo = useEditorCanRedo();
  const undo = useCourseEditorStore((s) => s.undo);
  const redo = useCourseEditorStore((s) => s.redo);

  return (
    <div className="flex items-center gap-0.5">
      <button
        disabled={!canUndo}
        onClick={undo}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast focus-ring disabled:opacity-30"
        aria-label="Undo"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h7a3 3 0 0 1 0 6H8" />
          <path d="M6 4L3 7l3 3" />
        </svg>
      </button>
      <button
        disabled={!canRedo}
        onClick={redo}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast focus-ring disabled:opacity-30"
        aria-label="Redo"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 7H6a3 3 0 0 0 0 6h2" />
          <path d="M10 4l3 3-3 3" />
        </svg>
      </button>
    </div>
  );
}

function PreviewButton() {
  const bottomBarVisible = useLayoutStore((s) => s.bottomBarVisible);
  const toggleBottomBar = useLayoutStore((s) => s.toggleBottomBar);

  return (
    <button
      onClick={toggleBottomBar}
      className={`
        flex h-8 items-center gap-1.5 rounded-md border px-3 text-ide-xs font-medium transition-colors duration-fast
        focus-ring press
        ${bottomBarVisible
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border text-muted-foreground"
        }
      `}
      aria-pressed={bottomBarVisible}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
        <path d="M2 7s2.2-3.5 5-3.5S12 7 12 7s-2.2 3.5-5 3.5S2 7 2 7z" />
        <circle cx="7" cy="7" r="1.5" />
      </svg>
      Preview
    </button>
  );
}

// ── Main Toolbar ──────────────────────────────────────────────────

type ToolbarProps = {
  readonly children: ReactNode;
};

export function Toolbar({ children }: ToolbarProps) {
  return (
    <div className="flex h-11 w-full shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      {children}
    </div>
  );
}

Toolbar.Breadcrumb = Breadcrumb;
Toolbar.Spacer = Spacer;
Toolbar.ViewToggle = ViewToggle;
Toolbar.UndoRedo = UndoRedo;
Toolbar.PreviewButton = PreviewButton;
