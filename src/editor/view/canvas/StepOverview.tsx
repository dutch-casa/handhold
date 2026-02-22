// StepOverview — the main editing surface when a step tab is active.
// Contains: inline-editable title, narration editor, block card grid with add-block buttons.
// Wired to StepEditorStore for mutations and CourseEditorStore for opening block tabs.

import { useState, useCallback, useRef, type ChangeEvent, type KeyboardEvent } from "react";
import type { VisualizationState } from "@/types/lesson";
import {
  useEditorCourse,
  useCourseEditorStore,
} from "@/editor/viewmodel/course-editor-store";
import { useStepEditor } from "@/editor/viewmodel/hooks";
import type { EditableStep, EditableBlock, EditorTabTarget } from "@/editor/model/types";
import { NarrationEditor } from "@/editor/view/canvas/NarrationEditor";

// ── Find step by ID across all lessons in the course ──────────────

function findStep(
  steps: readonly { readonly kind: string; readonly id: string; steps?: EditableStep[] }[],
  stepId: string,
): EditableStep | undefined {
  for (const courseStep of steps) {
    if (courseStep.kind !== "lesson") continue;
    if (!courseStep.steps) continue;
    const found = courseStep.steps.find((s) => s.id === stepId);
    if (found) return found;
  }
  return undefined;
}

// ── Block kind metadata ───────────────────────────────────────────

type BlockKindMeta = {
  readonly kind: VisualizationState["kind"];
  readonly label: string;
  readonly icon: string;
  readonly color: string;
};

const BLOCK_KINDS: readonly BlockKindMeta[] = [
  { kind: "code", label: "Code", icon: "{ }", color: "text-blue-400 border-blue-500/30 hover:bg-blue-500/10" },
  { kind: "data", label: "Data", icon: "[ ]", color: "text-green-400 border-green-500/30 hover:bg-green-500/10" },
  { kind: "diagram", label: "Diagram", icon: "◇", color: "text-purple-400 border-purple-500/30 hover:bg-purple-500/10" },
  { kind: "math", label: "Math", icon: "∑", color: "text-amber-400 border-amber-500/30 hover:bg-amber-500/10" },
  { kind: "chart", label: "Chart", icon: "📊", color: "text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10" },
  { kind: "preview", label: "Preview", icon: "▶", color: "text-rose-400 border-rose-500/30 hover:bg-rose-500/10" },
];

// ── Editable step title ───────────────────────────────────────────

function StepTitle({
  title,
  onChange,
}: {
  readonly title: string;
  readonly onChange: (title: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      inputRef.current?.blur();
    },
    [],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      value={title}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder="Step title..."
      aria-label="Step title"
      className="w-full border-none bg-transparent text-xl font-semibold text-foreground
        placeholder:text-muted-foreground/40 focus:outline-none"
    />
  );
}

// ── Block card ────────────────────────────────────────────────────

function blockTabKind(kind: EditableBlock["kind"]): EditorTabTarget["kind"] {
  switch (kind) {
    case "code": return "code-block";
    case "data": return "data-block";
    case "diagram": return "diagram-block";
    case "math": return "math-block";
    case "chart": return "chart-block";
    case "preview": return "preview-block";
  }
}

function BlockCard({
  block,
  stepId,
  onOpen,
  onRemove,
}: {
  readonly block: EditableBlock;
  readonly stepId: string;
  readonly onOpen: (target: EditorTabTarget) => void;
  readonly onRemove: (name: string) => void;
}) {
  const meta = BLOCK_KINDS.find((m) => m.kind === block.kind);

  const handleClick = useCallback(() => {
    onOpen({
      kind: blockTabKind(block.kind),
      stepId,
      blockName: block.name,
    } as EditorTabTarget);
  }, [block.kind, block.name, stepId, onOpen]);

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onRemove(block.name);
    },
    [block.name, onRemove],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Open ${block.name} (${block.kind})`}
      className="group/card relative flex flex-col items-start gap-1 rounded-lg border border-border
        bg-card px-sp-4 py-sp-3 text-left transition-colors duration-fast
        hover:border-primary/50 hover:bg-accent/30 focus-visible:outline-none
        focus-visible:ring-1 focus-visible:ring-ring min-h-[72px]"
    >
      <div className="flex items-center gap-sp-2">
        <span className="font-mono text-ide-xs text-muted-foreground">{meta?.icon}</span>
        <span className="text-ide-xs font-medium text-foreground">{block.name}</span>
      </div>
      <span className="text-ide-2xs text-muted-foreground">{block.kind}</span>

      {/* Remove button */}
      <button
        type="button"
        onClick={handleRemove}
        aria-label={`Remove ${block.name}`}
        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded
          text-muted-foreground/50 opacity-0 transition-opacity duration-fast
          group-hover/card:opacity-100 hover:bg-destructive/20 hover:text-destructive
          focus-visible:opacity-100"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <path d="M2 2l6 6M8 2l-6 6" />
        </svg>
      </button>
    </button>
  );
}

// ── Add block button ──────────────────────────────────────────────

function AddBlockButton({
  meta,
  onAdd,
}: {
  readonly meta: BlockKindMeta;
  readonly onAdd: (kind: VisualizationState["kind"]) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAdd(meta.kind)}
      aria-label={`Add ${meta.label} block`}
      className={`flex items-center gap-sp-2 rounded-lg border border-dashed px-sp-3 py-sp-2
        text-ide-xs font-medium transition-colors duration-fast min-h-[44px]
        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${meta.color}`}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
        <path d="M7 2v10M2 7h10" />
      </svg>
      {meta.label}
    </button>
  );
}

// ── Name prompt dialog ────────────────────────────────────────────

function NamePrompt({
  kind,
  onConfirm,
  onCancel,
}: {
  readonly kind: string;
  readonly onConfirm: (name: string) => void;
  readonly onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }, [name, onConfirm]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
    },
    [handleSubmit, onCancel],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="flex w-80 flex-col gap-sp-3 rounded-lg border border-border bg-popover p-sp-6 shadow-lg"
        role="dialog"
        aria-label={`Name the new ${kind} block`}
      >
        <h3 className="text-ide-sm font-semibold text-foreground">
          New {kind} block
        </h3>
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Block name..."
          aria-label="Block name"
          autoFocus
          className="rounded-md border border-border bg-input px-sp-3 py-sp-2 text-ide-sm
            text-foreground placeholder:text-muted-foreground/50
            focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex justify-end gap-sp-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-sp-3 py-sp-2 text-ide-xs text-muted-foreground
              transition-colors duration-fast hover:bg-accent min-h-[36px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="rounded-md bg-primary px-sp-4 py-sp-2 text-ide-xs font-medium text-primary-foreground
              transition-colors duration-fast hover:bg-primary/90
              disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── StepOverview (inner, receives step) ───────────────────────────

function StepOverviewInner({ step }: { readonly step: EditableStep }) {
  const store = useStepEditor(step);
  const {
    updateNarrationText,
    addParagraph,
    addTrigger,
    updateTrigger,
    removeTrigger,
    addBlock,
    removeBlock,
  } = store();
  const narration = store((s) => s.step.narration);
  const blocks = store((s) => s.step.blocks);

  const openTab = useCourseEditorStore((s) => s.openTab);

  const [addingBlockKind, setAddingBlockKind] = useState<VisualizationState["kind"] | null>(null);

  // Collect block names + regions for autocomplete targets.
  const blockNames: string[] = [];
  const regionNames: string[] = [];
  blocks.forEach((block, name) => {
    blockNames.push(name);
    for (const region of block.regions) {
      regionNames.push(region.name);
    }
  });

  // ── Title update ────────────────────────────────────────────────
  // Step title is on the EditableStep directly — mutate + trigger re-render.
  const handleTitleChange = useCallback(
    (title: string) => {
      step.title = title;
      // Force store re-render by touching the step reference.
      store.setState((s) => ({ step: { ...s.step } }));
    },
    [step, store],
  );

  // ── Add block flow ──────────────────────────────────────────────

  const handleAddBlockRequest = useCallback((kind: VisualizationState["kind"]) => {
    setAddingBlockKind(kind);
  }, []);

  const handleAddBlockConfirm = useCallback(
    (name: string) => {
      if (!addingBlockKind) return;

      addBlock(addingBlockKind, name);

      // Open the block's editor tab.
      openTab({
        kind: blockTabKind(addingBlockKind),
        stepId: step.id,
        blockName: name,
      } as EditorTabTarget);

      setAddingBlockKind(null);
    },
    [addingBlockKind, addBlock, openTab, step.id],
  );

  const handleAddBlockCancel = useCallback(() => {
    setAddingBlockKind(null);
  }, []);

  // ── Block removal ───────────────────────────────────────────────

  const handleRemoveBlock = useCallback(
    (name: string) => {
      removeBlock(name);
    },
    [removeBlock],
  );

  // ── Render ──────────────────────────────────────────────────────

  const blockEntries: EditableBlock[] = [];
  blocks.forEach((block) => blockEntries.push(block));

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-sp-6 p-sp-6">
        {/* Step title */}
        <section aria-label="Step title">
          <StepTitle title={step.title} onChange={handleTitleChange} />
          <div className="mt-1 h-px bg-border" />
        </section>

        {/* Narration */}
        <section aria-label="Narration">
          <h2 className="mb-sp-3 text-ide-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Narration
          </h2>
          <NarrationEditor
            narration={narration}
            blockNames={blockNames}
            regions={regionNames}
            onUpdateText={updateNarrationText}
            onAddParagraph={addParagraph}
            onAddTrigger={addTrigger}
            onUpdateTrigger={updateTrigger}
            onRemoveTrigger={removeTrigger}
          />
        </section>

        {/* Blocks */}
        <section aria-label="Blocks">
          <h2 className="mb-sp-3 text-ide-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Blocks
          </h2>

          {/* Existing block cards */}
          {blockEntries.length > 0 && (
            <div className="mb-sp-4 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-sp-3">
              {blockEntries.map((block) => (
                <BlockCard
                  key={block.name}
                  block={block}
                  stepId={step.id}
                  onOpen={openTab}
                  onRemove={handleRemoveBlock}
                />
              ))}
            </div>
          )}

          {/* Add block buttons */}
          <div className="flex flex-wrap gap-sp-2">
            {BLOCK_KINDS.map((meta) => (
              <AddBlockButton key={meta.kind} meta={meta} onAdd={handleAddBlockRequest} />
            ))}
          </div>
        </section>
      </div>

      {/* Name prompt modal */}
      {addingBlockKind && (
        <NamePrompt
          kind={addingBlockKind}
          onConfirm={handleAddBlockConfirm}
          onCancel={handleAddBlockCancel}
        />
      )}
    </div>
  );
}

// ── StepOverview (outer, resolves step from course) ───────────────

export function StepOverview({ stepId }: { readonly stepId: string }) {
  const course = useEditorCourse();

  if (!course) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground/50">No course loaded</span>
      </div>
    );
  }

  const step = findStep(course.steps, stepId);
  if (!step) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground/50">
          Step not found: {stepId}
        </span>
      </div>
    );
  }

  return <StepOverviewInner step={step} />;
}
