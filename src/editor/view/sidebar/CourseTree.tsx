// CourseTree — expandable tree rendering the course structure.
// Lessons expand to show H1 steps; labs are leaf nodes.
// Drag to reorder, right-click context menu, click to open tab.
//
// INVARIANTS:
//   T1: Each node's click dispatches exactly one openTab() call.
//   T2: Context menu is a positioned div, no external lib.
//   T3: Drag uses HTML5 drag-and-drop (ondragstart, ondragover, ondrop).

import { useState, useCallback, useRef, useEffect } from "react";
import {
  useCourseEditorStore,
  useEditorCourse,
  useEditorSteps,
} from "@/editor/viewmodel/course-editor-store";
import type { EditableCourseStep, EditorTabTarget } from "@/editor/model/types";

// ── Icons ────────────────────────────────────────────────────────

function LessonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M3 2h7l3 3v9H3V2z" />
      <path d="M10 2v3h3" />
      <path d="M5.5 7h5" />
      <path d="M5.5 9.5h5" />
    </svg>
  );
}

function LabIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M6 2v4L3 12.5a1 1 0 00.87 1.5h8.26a1 1 0 00.87-1.5L10 6V2" />
      <path d="M5 2h6" />
      <path d="M4.5 10h7" />
    </svg>
  );
}

function StepIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" className="shrink-0">
      <path d="M5 4h6" />
      <path d="M5 8h6" />
      <path d="M5 12h4" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { readonly expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={`shrink-0 transition-transform duration-fast ${expanded ? "rotate-90" : ""}`}
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function DragHandle() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="shrink-0 opacity-0 group-hover/node:opacity-40 transition-opacity duration-fast cursor-grab active:cursor-grabbing">
      <circle cx="4" cy="3" r="1" />
      <circle cx="8" cy="3" r="1" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="8" cy="6" r="1" />
      <circle cx="4" cy="9" r="1" />
      <circle cx="8" cy="9" r="1" />
    </svg>
  );
}

// ── Context menu ─────────────────────────────────────────────────

type ContextMenuState = {
  readonly x: number;
  readonly y: number;
  readonly stepId: string;
  readonly stepIndex: number;
};

type ContextMenuAction = "rename" | "delete" | "add-lesson-after" | "add-lab-after";

const CONTEXT_MENU_ITEMS: ReadonlyArray<{
  readonly id: ContextMenuAction;
  readonly label: string;
  readonly destructive?: true;
}> = [
  { id: "rename", label: "Rename" },
  { id: "add-lesson-after", label: "Add Lesson After" },
  { id: "add-lab-after", label: "Add Lab After" },
  { id: "delete", label: "Delete", destructive: true },
];

function ContextMenu({
  state,
  onAction,
  onClose,
}: {
  readonly state: ContextMenuState;
  readonly onAction: (action: ContextMenuAction, stepId: string, stepIndex: number) => void;
  readonly onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-elevation-3 motion-enter"
      style={{ left: state.x, top: state.y }}
      role="menu"
    >
      {CONTEXT_MENU_ITEMS.map((item) => (
        <button
          key={item.id}
          role="menuitem"
          onClick={() => {
            onAction(item.id, state.stepId, state.stepIndex);
            onClose();
          }}
          className={`
            flex w-full items-center px-sp-3 py-1.5 text-left text-ide-xs
            transition-colors duration-fast focus-ring
            hover:bg-accent
            ${item.destructive ? "text-destructive" : "text-popover-foreground"}
          `}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ── Inline rename input ──────────────────────────────────────────

function RenameInput({
  initialValue,
  onCommit,
  onCancel,
}: {
  readonly initialValue: string;
  readonly onCommit: (value: string) => void;
  readonly onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      const trimmed = value.trim();
      if (trimmed.length > 0) onCommit(trimmed);
      return;
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        const trimmed = value.trim();
        if (trimmed.length > 0 && trimmed !== initialValue) {
          onCommit(trimmed);
          return;
        }
        onCancel();
      }}
      className="min-w-0 flex-1 rounded-sm border border-primary/50 bg-background px-1 py-0.5 text-ide-xs text-foreground outline-none"
      aria-label="Rename step"
    />
  );
}

// ── Tree node ────────────────────────────────────────────────────

type TreeNodeProps = {
  readonly step: EditableCourseStep;
  readonly index: number;
  readonly onOpenTab: (target: EditorTabTarget) => void;
  readonly onContextMenu: (e: React.MouseEvent, stepId: string, index: number) => void;
  readonly renamingId: string | null;
  readonly onRenameCommit: (stepId: string, value: string) => void;
  readonly onRenameCancel: () => void;
  readonly dragIndex: number | null;
  readonly dropIndex: number | null;
  readonly onDragStart: (index: number) => void;
  readonly onDragOver: (e: React.DragEvent, index: number) => void;
  readonly onDrop: (e: React.DragEvent) => void;
  readonly onDragEnd: () => void;
};

function TreeNode({
  step,
  index,
  onOpenTab,
  onContextMenu,
  renamingId,
  onRenameCommit,
  onRenameCancel,
  dragIndex,
  dropIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const isRenaming = renamingId === step.id;
  const isDragTarget = dropIndex === index && dragIndex !== index;

  function handleClick() {
    if (isRenaming) return;

    if (step.kind === "lab") {
      onOpenTab({ kind: "lab-config", stepId: step.id });
      return;
    }

    // Lesson: toggle expand, also open the step-overview for the first step
    setExpanded((prev) => !prev);
  }

  function handleStepClick(stepId: string) {
    onOpenTab({ kind: "step-overview", stepId });
  }

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={step.kind === "lesson" ? expanded : undefined}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart(index);
        }}
        onDragOver={(e) => onDragOver(e, index)}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, step.id, index);
        }}
        onClick={handleClick}
        className={`
          group/node flex items-center gap-1 px-sp-2 py-1 cursor-pointer select-none
          transition-colors duration-fast hover:bg-sidebar-accent
          ${isDragTarget ? "bg-primary/10 border-t border-primary/40" : ""}
        `}
      >
        <DragHandle />

        {step.kind === "lesson" ? (
          <ChevronIcon expanded={expanded} />
        ) : (
          <div className="w-4" />
        )}

        {step.kind === "lesson" ? <LessonIcon /> : <LabIcon />}

        {isRenaming ? (
          <RenameInput
            initialValue={step.title}
            onCommit={(v) => onRenameCommit(step.id, v)}
            onCancel={onRenameCancel}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-ide-xs text-sidebar-foreground">
            {step.title || (step.kind === "lesson" ? "Untitled Lesson" : "Untitled Lab")}
          </span>
        )}
      </div>

      {/* Lesson children: H1 steps */}
      {step.kind === "lesson" && expanded && (
        <div role="group" className="ml-sp-6">
          {step.steps.length === 0 ? (
            <div className="px-sp-2 py-1 text-ide-2xs text-muted-foreground italic">
              No steps
            </div>
          ) : (
            step.steps.map((s) => (
              <div
                key={s.id}
                role="treeitem"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStepClick(s.id);
                }}
                className="group/node flex items-center gap-1 px-sp-2 py-1 cursor-pointer select-none transition-colors duration-fast hover:bg-sidebar-accent"
              >
                <div className="w-3" />
                <StepIcon />
                <span className="min-w-0 flex-1 truncate text-ide-xs text-sidebar-foreground">
                  {s.title || "Untitled Step"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── CourseTree ────────────────────────────────────────────────────

export function CourseTree() {
  const course = useEditorCourse();
  const steps = useEditorSteps();
  const openTab = useCourseEditorStore((s) => s.openTab);
  const addLesson = useCourseEditorStore((s) => s.addLesson);
  const addLab = useCourseEditorStore((s) => s.addLab);
  const removeStep = useCourseEditorStore((s) => s.removeStep);
  const moveStep = useCourseEditorStore((s) => s.moveStep);
  const renameStep = useCourseEditorStore((s) => s.renameStep);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, stepId: string, stepIndex: number) => {
    setContextMenu({ x: e.clientX, y: e.clientY, stepId, stepIndex });
  }, []);

  const handleContextAction = useCallback(
    (action: ContextMenuAction, stepId: string, _stepIndex: number) => {
      switch (action) {
        case "rename":
          setRenamingId(stepId);
          break;
        case "delete":
          removeStep(stepId);
          break;
        case "add-lesson-after":
          addLesson("New Lesson");
          break;
        case "add-lab-after":
          addLab("New Lab");
          break;
      }
    },
    [removeStep, addLesson, addLab],
  );

  const handleRenameCommit = useCallback(
    (stepId: string, value: string) => {
      renameStep(stepId, value);
      setRenamingId(null);
    },
    [renameStep],
  );

  const handleRenameCancel = useCallback(() => {
    setRenamingId(null);
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragIndex === null) return;
      if (index === dragIndex) {
        setDropIndex(null);
        return;
      }
      setDropIndex(index);
    },
    [dragIndex],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (dragIndex === null || dropIndex === null) return;
      if (dragIndex === dropIndex) return;
      moveStep(dragIndex, dropIndex);
      setDragIndex(null);
      setDropIndex(null);
    },
    [dragIndex, dropIndex, moveStep],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDropIndex(null);
  }, []);

  if (!course) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-xs text-muted-foreground">No course loaded</span>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Section header */}
      <button className="ide-section-header" aria-label="Course Tree section">
        <span className="truncate">{course.title || "Course"}</span>
      </button>

      {/* Tree body */}
      <div className="flex-1 overflow-y-auto ide-scrollbar" role="tree" aria-label="Course structure">
        {steps.length === 0 ? (
          <div className="px-sp-3 py-sp-4 text-center text-ide-xs text-muted-foreground">
            Add a lesson or lab to get started.
          </div>
        ) : (
          steps.map((step, i) => (
            <TreeNode
              key={step.id}
              step={step}
              index={i}
              onOpenTab={openTab}
              onContextMenu={handleContextMenu}
              renamingId={renamingId}
              onRenameCommit={handleRenameCommit}
              onRenameCancel={handleRenameCancel}
              dragIndex={dragIndex}
              dropIndex={dropIndex}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>

      {/* Add buttons */}
      <div className="flex shrink-0 gap-sp-1 border-t border-border px-sp-2 py-sp-2">
        <button
          onClick={() => addLesson("New Lesson")}
          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-border text-ide-xs text-muted-foreground transition-colors duration-fast hover:text-foreground hover:border-foreground/20 focus-ring press"
          aria-label="Add lesson"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M7 3v8M3 7h8" />
          </svg>
          Lesson
        </button>
        <button
          onClick={() => addLab("New Lab")}
          className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md border border-border text-ide-xs text-muted-foreground transition-colors duration-fast hover:text-foreground hover:border-foreground/20 focus-ring press"
          aria-label="Add lab"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M7 3v8M3 7h8" />
          </svg>
          Lab
        </button>
      </div>

      {/* Context menu portal */}
      {contextMenu && (
        <ContextMenu
          state={contextMenu}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
