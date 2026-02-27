// LabConfigEditor — structured form for lab configuration.
// Renders workspace mode, test command, setup commands, and open files.
// Wired to the LabEditorStore for all mutations.

import { useCallback, useRef, useState } from "react";
import { useLabEditor } from "@/editor/viewmodel/lab-editor-store";
import { useCourseEditorStore } from "@/editor/viewmodel/course-editor-store";
import type { EditableLab } from "@/editor/model/types";

// ── Helpers ────────────────────────────────────────────────────

function findLabForStep(stepId: string): EditableLab | undefined {
  const course = useCourseEditorStore.getState().course;
  if (!course) return undefined;
  const step = course.steps.find((s) => s.id === stepId);
  if (!step || step.kind !== "lab") return undefined;
  return step.lab;
}

// ── CommandList — reusable add/remove/reorder for string[] ────

type CommandListProps = {
  readonly label: string;
  readonly items: readonly string[];
  readonly onAdd: (cmd: string) => void;
  readonly onRemove: (index: number) => void;
  readonly onReorder: (fromIndex: number, toIndex: number) => void;
};

function CommandList({ label, items, onAdd, onRemove, onReorder }: CommandListProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
    inputRef.current?.focus();
  }, [draft, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      handleAdd();
    },
    [handleAdd],
  );

  return (
    <fieldset className="flex flex-col gap-sp-2">
      <legend className="text-ide-xs font-semibold text-foreground">{label}</legend>
      <ul className="flex flex-col gap-sp-1">
        {items.map((cmd, i) => (
          <li key={i} className="group flex items-center gap-sp-2">
            <span className="flex-1 truncate rounded-sm bg-secondary px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground">
              {cmd}
            </span>
            {i > 0 && (
              <button
                type="button"
                className="tap-target focus-ring min-h-[44px] min-w-[44px] rounded-sm px-sp-1 text-ide-xs text-muted-foreground opacity-0 transition-opacity duration-fast group-hover:opacity-100"
                aria-label={`Move "${cmd}" up`}
                onClick={() => { onReorder(i, i - 1); }}
              >
                Up
              </button>
            )}
            {i < items.length - 1 && (
              <button
                type="button"
                className="tap-target focus-ring min-h-[44px] min-w-[44px] rounded-sm px-sp-1 text-ide-xs text-muted-foreground opacity-0 transition-opacity duration-fast group-hover:opacity-100"
                aria-label={`Move "${cmd}" down`}
                onClick={() => { onReorder(i, i + 1); }}
              >
                Dn
              </button>
            )}
            <button
              type="button"
              className="tap-target focus-ring min-h-[44px] min-w-[44px] rounded-sm px-sp-1 text-ide-xs text-destructive opacity-0 transition-opacity duration-fast group-hover:opacity-100"
              aria-label={`Remove "${cmd}"`}
              onClick={() => { onRemove(i); }}
            >
              Del
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-sp-2">
        <input
          ref={inputRef}
          type="text"
          className="focus-ring flex-1 rounded-sm border border-border bg-secondary px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground placeholder:text-muted-foreground/50"
          placeholder="Add command..."
          value={draft}
          onChange={(e) => { setDraft(e.target.value); }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="press focus-ring min-h-[44px] min-w-[44px] rounded-sm bg-primary px-sp-3 py-sp-1 text-ide-xs font-medium text-primary-foreground"
          aria-label={`Add ${label.toLowerCase()} command`}
          onClick={handleAdd}
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}

// ── FileList — add/remove for open files ──────────────────────

type FileListProps = {
  readonly items: readonly string[];
  readonly onAdd: (path: string) => void;
  readonly onRemove: (path: string) => void;
};

function FileList({ items, onAdd, onRemove }: FileListProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
    inputRef.current?.focus();
  }, [draft, onAdd]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      handleAdd();
    },
    [handleAdd],
  );

  return (
    <fieldset className="flex flex-col gap-sp-2">
      <legend className="text-ide-xs font-semibold text-foreground">Open Files</legend>
      <ul className="flex flex-col gap-sp-1">
        {items.map((path) => (
          <li key={path} className="group flex items-center gap-sp-2">
            <span className="flex-1 truncate rounded-sm bg-secondary px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground">
              {path}
            </span>
            <button
              type="button"
              className="tap-target focus-ring min-h-[44px] min-w-[44px] rounded-sm px-sp-1 text-ide-xs text-destructive opacity-0 transition-opacity duration-fast group-hover:opacity-100"
              aria-label={`Remove "${path}"`}
              onClick={() => { onRemove(path); }}
            >
              Del
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-sp-2">
        <input
          ref={inputRef}
          type="text"
          className="focus-ring flex-1 rounded-sm border border-border bg-secondary px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground placeholder:text-muted-foreground/50"
          placeholder="Add file path..."
          value={draft}
          onChange={(e) => { setDraft(e.target.value); }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="press focus-ring min-h-[44px] min-w-[44px] rounded-sm bg-primary px-sp-3 py-sp-1 text-ide-xs font-medium text-primary-foreground"
          aria-label="Add open file"
          onClick={handleAdd}
        >
          Add
        </button>
      </div>
    </fieldset>
  );
}

// ── LabConfigEditor ───────────────────────────────────────────

type LabConfigEditorProps = {
  readonly stepId: string;
};

export function LabConfigEditor({ stepId }: LabConfigEditorProps) {
  const lab = findLabForStep(stepId);
  if (!lab) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground">Lab not found</span>
      </div>
    );
  }

  return <LabConfigForm lab={lab} />;
}

function LabConfigForm({ lab }: { readonly lab: EditableLab }) {
  const store = useLabEditor(lab);

  return (
    <div className="ide-scrollbar flex flex-col gap-sp-6 overflow-y-auto p-sp-4">
      <h2 className="text-ide-lg font-semibold text-foreground">Lab Configuration</h2>

      {/* Workspace mode */}
      <fieldset className="flex flex-col gap-sp-2">
        <legend className="text-ide-xs font-semibold text-foreground">Workspace Mode</legend>
        <div className="flex gap-sp-4">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-sp-2 text-ide-xs text-foreground">
            <input
              type="radio"
              name="workspace-mode"
              className="focus-ring accent-primary"
              checked={store.lab.workspace === "fresh"}
              onChange={() => { store.updateWorkspace("fresh"); }}
            />
            Fresh
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-sp-2 text-ide-xs text-foreground">
            <input
              type="radio"
              name="workspace-mode"
              className="focus-ring accent-primary"
              checked={store.lab.workspace === "continue"}
              onChange={() => { store.updateWorkspace("continue"); }}
            />
            Continue
          </label>
        </div>
      </fieldset>

      {/* Test command */}
      <fieldset className="flex flex-col gap-sp-2">
        <legend className="text-ide-xs font-semibold text-foreground">Test Command</legend>
        <input
          type="text"
          className="focus-ring min-h-[44px] rounded-sm border border-border bg-secondary px-sp-2 py-sp-1 font-mono text-ide-xs text-foreground placeholder:text-muted-foreground/50"
          placeholder="e.g. npm test"
          value={store.lab.testCommand}
          onChange={(e) => { store.updateTestCommand(e.target.value); }}
          aria-label="Test command"
        />
      </fieldset>

      {/* Setup commands */}
      <CommandList
        label="Setup Commands"
        items={store.lab.setup}
        onAdd={store.addSetupCommand}
        onRemove={store.removeSetupCommand}
        onReorder={store.reorderSetupCommand}
      />

      {/* Open files */}
      <FileList
        items={store.lab.openFiles}
        onAdd={store.addOpenFile}
        onRemove={store.removeOpenFile}
      />
    </div>
  );
}
