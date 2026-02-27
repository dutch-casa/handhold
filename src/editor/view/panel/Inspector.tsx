// Inspector panel — context-sensitive property inspector.
// Shows different key-value sections based on the active editor tab.
// Lives inside Layout.Panel when panelTab === "inspector".

import { type ChangeEvent, useCallback } from "react";
import {
  useCourseEditorStore,
  useEditorActiveTab,
  useEditorCourse,
} from "@/editor/viewmodel/course-editor-store";
import type {
  EditableCourse,
  EditableStep,
  EditableBlock,
  EditableCodeBlock,
  EditableDataBlock,
  EditableDiagramBlock,
  EditableMathBlock,
  EditableChartBlock,
  EditablePreviewBlock,
  EditableLab,
  EditableCourseStep,
  EditorTabTarget,
} from "@/editor/model/types";
import { compileScenes } from "@/editor/model/scene-compiler";

// ── Key-value row primitives ────────────────────────────────────

function Row({ label, value }: { readonly label: string; readonly value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-sp-2 py-[3px]">
      <span className="shrink-0 text-ide-2xs text-muted-foreground">{label}</span>
      <span className="truncate text-right text-ide-2xs text-foreground">{String(value)}</span>
    </div>
  );
}

type EditableRowProps = {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

function EditableRow({ label, value, onChange }: EditableRowProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
    [onChange],
  );

  return (
    <div className="flex items-baseline justify-between gap-sp-2 py-[3px]">
      <span className="shrink-0 text-ide-2xs text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className="
          w-0 min-w-[80px] flex-1 truncate rounded-sm border border-transparent
          bg-transparent px-sp-1 text-right text-ide-2xs text-foreground
          focus:border-primary/50 focus:outline-none
          hover:border-border
          transition-colors duration-fast
        "
      />
    </div>
  );
}

function SectionHeader({ title }: { readonly title: string }) {
  return (
    <div className="ide-section-header mt-sp-2 first:mt-0">
      <span>{title}</span>
    </div>
  );
}

function SectionBody({ children }: { readonly children: React.ReactNode }) {
  return <div className="px-sp-3 py-sp-1">{children}</div>;
}

// ── Data derivation helpers (pure) ──────────────────────────────

function countWords(narration: EditableStep["narration"]): number {
  let count = 0;
  for (const para of narration) {
    const trimmed = para.text.trim();
    if (trimmed.length === 0) continue;
    count += trimmed.split(/\s+/).length;
  }
  return count;
}

function countTriggers(narration: EditableStep["narration"]): number {
  let count = 0;
  for (const para of narration) {
    count += para.triggers.length;
  }
  return count;
}

function totalBlockCount(course: EditableCourse): number {
  let count = 0;
  for (const step of course.steps) {
    if (step.kind === "lesson") {
      for (const sub of step.steps) {
        count += sub.blocks.size;
      }
    }
  }
  return count;
}

function dataTypeLabel(data: EditableDataBlock["data"]): string {
  return data.type;
}

function codeLineCount(block: EditableCodeBlock): number {
  if (block.content.length === 0) return 0;
  return block.content.split("\n").length;
}

// ── Section: Course summary (nothing selected) ──────────────────

function CourseSection({ course }: { readonly course: EditableCourse }) {
  return (
    <>
      <SectionHeader title="Course" />
      <SectionBody>
        <Row label="Title" value={course.title || "(untitled)"} />
        <Row label="Steps" value={course.steps.length} />
        <Row label="Total blocks" value={totalBlockCount(course)} />
      </SectionBody>
    </>
  );
}

// ── Section: Step overview ──────────────────────────────────────

function StepOverviewSection({
  step,
  courseStep,
}: {
  readonly step: EditableStep;
  readonly courseStep: EditableCourseStep;
}) {
  const renameStep = useCourseEditorStore((s) => s.renameStep);
  const handleTitleChange = useCallback(
    (value: string) => renameStep(courseStep.id, value),
    [renameStep, courseStep.id],
  );

  let sceneCount = 0;
  try {
    sceneCount = compileScenes(step).length;
  } catch {
    // Intermediate editing state; scenes may not compile.
  }

  return (
    <>
      <SectionHeader title="Step" />
      <SectionBody>
        <EditableRow label="Title" value={courseStep.title} onChange={handleTitleChange} />
        <Row label="Paragraphs" value={step.narration.length} />
        <Row label="Triggers" value={countTriggers(step.narration)} />
        <Row label="Blocks" value={step.blocks.size} />
        <Row label="Scenes" value={sceneCount} />
        <Row label="Words" value={countWords(step.narration)} />
      </SectionBody>
    </>
  );
}

// ── Section: Block inspectors ───────────────────────────────────

function CodeBlockSection({ block }: { readonly block: EditableCodeBlock }) {
  return (
    <>
      <SectionHeader title="Code Block" />
      <SectionBody>
        <Row label="Name" value={block.name} />
        <Row label="Kind" value="code" />
        <Row label="Language" value={block.lang || "(none)"} />
        <Row label="Lines" value={codeLineCount(block)} />
        <Row label="Annotations" value={block.annotations.length} />
        <Row label="Regions" value={block.regions.length} />
      </SectionBody>
    </>
  );
}

function DataBlockSection({ block }: { readonly block: EditableDataBlock }) {
  const nodeCount = "values" in block.data ? block.data.values.length : 0;
  return (
    <>
      <SectionHeader title="Data Block" />
      <SectionBody>
        <Row label="Name" value={block.name} />
        <Row label="Kind" value="data" />
        <Row label="Data type" value={dataTypeLabel(block.data)} />
        <Row label="Node count" value={nodeCount} />
      </SectionBody>
    </>
  );
}

function DiagramBlockSection({ block }: { readonly block: EditableDiagramBlock }) {
  return (
    <>
      <SectionHeader title="Diagram Block" />
      <SectionBody>
        <Row label="Name" value={block.name} />
        <Row label="Kind" value="diagram" />
        <Row label="Nodes" value={block.nodes.length} />
        <Row label="Edges" value={block.edges.length} />
        <Row label="Groups" value={block.groups.length} />
      </SectionBody>
    </>
  );
}

function MathBlockSection({ block }: { readonly block: EditableMathBlock }) {
  return (
    <>
      <SectionHeader title="Math Block" />
      <SectionBody>
        <Row label="Name" value={block.name} />
        <Row label="Kind" value="math" />
        <Row label="Expressions" value={block.expressions.length} />
      </SectionBody>
    </>
  );
}

function ChartBlockSection({ block }: { readonly block: EditableChartBlock }) {
  return (
    <>
      <SectionHeader title="Chart Block" />
      <SectionBody>
        <Row label="Name" value={block.name} />
        <Row label="Kind" value="chart" />
        <Row label="Chart type" value={block.chartKind} />
        <Row label="Series" value={block.series.length} />
      </SectionBody>
    </>
  );
}

function PreviewBlockSection({ block }: { readonly block: EditablePreviewBlock }) {
  return (
    <>
      <SectionHeader title="Preview Block" />
      <SectionBody>
        <Row label="Name" value={block.name} />
        <Row label="Kind" value="preview" />
        <Row label="Template" value={block.template} />
      </SectionBody>
    </>
  );
}

function BlockSection({ block }: { readonly block: EditableBlock }) {
  switch (block.kind) {
    case "code":
      return <CodeBlockSection block={block} />;
    case "data":
      return <DataBlockSection block={block} />;
    case "diagram":
      return <DiagramBlockSection block={block} />;
    case "math":
      return <MathBlockSection block={block} />;
    case "chart":
      return <ChartBlockSection block={block} />;
    case "preview":
      return <PreviewBlockSection block={block} />;
  }
}

// ── Section: Lab inspector ──────────────────────────────────────

function LabSection({ lab }: { readonly lab: EditableLab }) {
  return (
    <>
      <SectionHeader title="Lab" />
      <SectionBody>
        <Row label="Title" value={lab.title || "(untitled)"} />
        <Row label="Workspace" value={lab.workspace} />
        <Row label="Test command" value={lab.testCommand || "(none)"} />
        <Row label="Services" value={lab.services.length} />
        <Row label="Setup commands" value={lab.setup.length} />
        <Row label="Open files" value={lab.openFiles.length} />
      </SectionBody>
    </>
  );
}

// ── Resolver: find step/block/lab from active tab target ────────

function resolveStepAndBlock(
  course: EditableCourse,
  target: EditorTabTarget,
): {
  courseStep: EditableCourseStep | undefined;
  step: EditableStep | undefined;
  block: EditableBlock | undefined;
  lab: EditableLab | undefined;
} {
  const courseStep = course.steps.find((s) => s.id === target.stepId);
  if (!courseStep) return { courseStep: undefined, step: undefined, block: undefined, lab: undefined };

  if (courseStep.kind === "lab") {
    return { courseStep, step: undefined, block: undefined, lab: courseStep.lab };
  }

  // For lesson steps, find the sub-step. The "stepId" in EditorTabTarget references
  // the course-level step (the lesson). The lesson may have multiple sub-steps.
  // For the inspector, show the first sub-step or the one matching the block.
  const lesson = courseStep;

  // Block tabs contain a blockName — find the sub-step containing that block.
  if ("blockName" in target) {
    for (const sub of lesson.steps) {
      const found = sub.blocks.get(target.blockName);
      if (found) return { courseStep, step: sub, block: found, lab: undefined };
    }
    // Block not found in any sub-step.
    return { courseStep, step: lesson.steps[0], block: undefined, lab: undefined };
  }

  // Step-overview or source tab — use the first sub-step.
  return { courseStep, step: lesson.steps[0], block: undefined, lab: undefined };
}

// ── Inspector content: dispatch by active tab ───────────────────

function InspectorContent() {
  const activeTab = useEditorActiveTab();
  const course = useEditorCourse();

  if (!course) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-xs text-muted-foreground">No course loaded</span>
      </div>
    );
  }

  // Nothing selected — show course summary.
  if (!activeTab) {
    return <CourseSection course={course} />;
  }

  const target = activeTab.target;
  const { courseStep, step, block, lab } = resolveStepAndBlock(course, target);

  switch (target.kind) {
    case "step-overview": {
      if (!courseStep || !step) return <CourseSection course={course} />;
      return <StepOverviewSection step={step} courseStep={courseStep} />;
    }

    case "code-block":
    case "data-block":
    case "diagram-block":
    case "math-block":
    case "chart-block":
    case "preview-block": {
      if (!block) return <CourseSection course={course} />;
      return <BlockSection block={block} />;
    }

    case "lab-config":
    case "lab-instructions":
    case "lab-scaffold": {
      if (!lab) return <CourseSection course={course} />;
      return <LabSection lab={lab} />;
    }

    case "source": {
      // Source view — show step overview if available, else course summary.
      if (courseStep && step) {
        return <StepOverviewSection step={step} courseStep={courseStep} />;
      }
      return <CourseSection course={course} />;
    }
  }
}

// ── Main export ─────────────────────────────────────────────────

export function Inspector() {
  return (
    <div className="flex h-full flex-col">
      <div className="ide-section-header shrink-0">
        <span>Inspector</span>
      </div>
      <div className="flex-1 overflow-y-auto ide-scrollbar">
        <InspectorContent />
      </div>
    </div>
  );
}
