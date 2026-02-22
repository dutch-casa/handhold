// Canvas — renders the active tab's content by dispatching on EditorTabTarget.kind.
// Tab bar sits at top; content fills remaining space. Placeholder editors for now.

import { useEditorActiveTab } from "@/editor/viewmodel/course-editor-store";
import { EditorTabs } from "@/editor/view/canvas/EditorTabs";
import { LabConfigEditor } from "@/editor/view/lab/LabConfigEditor";
import { LabInstructionsEditor } from "@/editor/view/lab/LabInstructionsEditor";
import { LabScaffoldTree } from "@/editor/view/lab/LabScaffoldTree";
import type { EditorTabTarget } from "@/editor/model/types";
import { StepOverview } from "@/editor/view/canvas/StepOverview";

// ── Placeholder shell ────────────────────────────────────────────
// Centered label showing the target kind + identifying info.

function Placeholder({ kind, detail }: { readonly kind: string; readonly detail: string }) {
  return (
    <div className="ide-empty-state h-full">
      <span className="rounded-md bg-secondary px-sp-3 py-sp-1 font-mono text-ide-xs text-muted-foreground">
        {kind}
      </span>
      <span className="text-ide-2xs text-muted-foreground/60">{detail}</span>
    </div>
  );
}

// ── Placeholder components per target kind ───────────────────────

// StepOverview replaces the placeholder — imported above.

function CodeBlockPlaceholder({ stepId, blockName }: { readonly stepId: string; readonly blockName: string }) {
  return <Placeholder kind="code-block" detail={`${stepId} / ${blockName}`} />;
}

function DataBlockPlaceholder({ stepId, blockName }: { readonly stepId: string; readonly blockName: string }) {
  return <Placeholder kind="data-block" detail={`${stepId} / ${blockName}`} />;
}

function DiagramBlockPlaceholder({ stepId, blockName }: { readonly stepId: string; readonly blockName: string }) {
  return <Placeholder kind="diagram-block" detail={`${stepId} / ${blockName}`} />;
}

function MathBlockPlaceholder({ stepId, blockName }: { readonly stepId: string; readonly blockName: string }) {
  return <Placeholder kind="math-block" detail={`${stepId} / ${blockName}`} />;
}

function ChartBlockPlaceholder({ stepId, blockName }: { readonly stepId: string; readonly blockName: string }) {
  return <Placeholder kind="chart-block" detail={`${stepId} / ${blockName}`} />;
}

function PreviewBlockPlaceholder({ stepId, blockName }: { readonly stepId: string; readonly blockName: string }) {
  return <Placeholder kind="preview-block" detail={`${stepId} / ${blockName}`} />;
}

function SourcePlaceholder({ stepId }: { readonly stepId: string }) {
  return <Placeholder kind="source" detail={stepId} />;
}

// ── Empty state ──────────────────────────────────────────────────

function EmptyCanvas() {
  return (
    <div className="ide-empty-state h-full">
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground/30"
        aria-hidden="true"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18M3 9h18" />
      </svg>
      <span className="text-ide-sm text-muted-foreground/50">
        Open a step or block from the sidebar
      </span>
    </div>
  );
}

// ── Target dispatch ──────────────────────────────────────────────

function TargetContent({ target }: { readonly target: EditorTabTarget }) {
  switch (target.kind) {
    case "step-overview":
      return <StepOverview stepId={target.stepId} />;
    case "code-block":
      return <CodeBlockPlaceholder stepId={target.stepId} blockName={target.blockName} />;
    case "data-block":
      return <DataBlockPlaceholder stepId={target.stepId} blockName={target.blockName} />;
    case "diagram-block":
      return <DiagramBlockPlaceholder stepId={target.stepId} blockName={target.blockName} />;
    case "math-block":
      return <MathBlockPlaceholder stepId={target.stepId} blockName={target.blockName} />;
    case "chart-block":
      return <ChartBlockPlaceholder stepId={target.stepId} blockName={target.blockName} />;
    case "preview-block":
      return <PreviewBlockPlaceholder stepId={target.stepId} blockName={target.blockName} />;
    case "lab-config":
      return <LabConfigEditor stepId={target.stepId} />;
    case "lab-instructions":
      return <LabInstructionsEditor stepId={target.stepId} />;
    case "lab-scaffold":
      return <LabScaffoldTree stepId={target.stepId} />;
    case "source":
      return <SourcePlaceholder stepId={target.stepId} />;
  }
}

// ── Canvas ───────────────────────────────────────────────────────

export function Canvas() {
  const activeTab = useEditorActiveTab();

  return (
    <div className="flex h-full flex-col">
      <EditorTabs />
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab ? <TargetContent target={activeTab.target} /> : <EmptyCanvas />}
      </div>
    </div>
  );
}
