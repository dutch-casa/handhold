// Deserializer — converts readonly parsed IR to mutable editable types.
// Deep copies everything so the editor model shares no references with the parser output.

import type { ParsedLesson, LessonStep, VisualizationState, NarrationBlock } from "@/types/lesson";
import type { ParsedLab, ResolvedService } from "@/types/lab";
import type { Course, CourseStep } from "@/types/course";
import type {
  EditableStep,
  EditableBlock,
  EditableNarration,
  EditableLab,
  EditableService,
  EditableCourse,
  EditableCourseStep,
  DeepMutable,
} from "@/editor/model/types";

// --- Core conversion: readonly block IR → mutable editable block ---
// structuredClone does the deep copy at runtime. The single cast per branch is safe
// because DeepMutable<T> is structurally identical to T sans readonly modifiers.

function deserializeBlock(block: VisualizationState): EditableBlock {
  const clone = structuredClone(block) as DeepMutable<typeof block>;

  switch (clone.kind) {
    case "code":
      return {
        kind: "code",
        name: clone.name,
        lang: clone.lang,
        fileName: clone.fileName,
        content: clone.content,
        regions: clone.regions,
        annotations: clone.annotations,
      };

    case "data":
      return {
        kind: "data",
        name: clone.name,
        data: clone.data,
        regions: clone.regions,
      };

    case "diagram":
      return {
        kind: "diagram",
        name: clone.name,
        nodes: clone.nodes,
        edges: clone.edges,
        groups: clone.groups,
        regions: clone.regions,
      };

    case "math":
      return {
        kind: "math",
        name: clone.name,
        expressions: clone.expressions,
        regions: clone.regions,
      };

    case "chart":
      return {
        kind: "chart",
        name: clone.name,
        chartKind: clone.chartKind,
        series: clone.series,
        annotations: clone.annotations,
        shadedRegions: clone.shadedRegions,
        regions: clone.regions,
      };

    case "preview":
      return {
        kind: "preview",
        name: clone.name,
        source: clone.source,
        template: clone.template,
        regions: clone.regions,
      };
  }
}

// --- Narration conversion ---

function deserializeNarration(narration: readonly NarrationBlock[]): EditableNarration[] {
  return narration.map((block) => ({
    text: block.text,
    triggers: block.triggers.map((t) => ({
      wordIndex: t.wordIndex,
      text: t.text,
      action: structuredClone(t.action),
    })),
  }));
}

// --- Step conversion ---

function deserializeStep(step: LessonStep): EditableStep {
  const blocks = new Map<string, EditableBlock>();
  for (const [name, block] of step.blocks) {
    blocks.set(name, deserializeBlock(block));
  }
  return {
    id: step.id,
    title: step.title,
    narration: deserializeNarration(step.narration),
    blocks,
  };
}

// --- Public API ---

export function deserializeLesson(lesson: ParsedLesson): EditableStep[] {
  return lesson.steps.map(deserializeStep);
}

// --- Service conversion ---

function deserializeService(service: ResolvedService): EditableService {
  return {
    name: service.name,
    image: service.image,
    port: service.port,
    hostPort: service.hostPort,
    env: { ...service.env },
    healthcheck: service.healthcheck,
  };
}

export function deserializeLab(lab: ParsedLab): EditableLab {
  return {
    title: lab.title,
    instructions: lab.instructions,
    workspace: lab.workspace,
    testCommand: lab.testCommand,
    openFiles: [...lab.openFiles],
    services: lab.services.map(deserializeService),
    setup: [...lab.setup],
    scaffoldPath: lab.filesPath,
  };
}

// --- Course conversion ---

function deserializeCourseStep(step: CourseStep, index: number): EditableCourseStep {
  switch (step.kind) {
    case "lesson":
      return {
        kind: "lesson",
        id: `lesson-${index}`,
        title: step.title,
        steps: deserializeLesson(step.lesson),
      };
    case "lab":
      return {
        kind: "lab",
        id: `lab-${index}`,
        title: step.title,
        lab: deserializeLab(step.lab),
      };
  }
}

export function deserializeCourse(course: Course): EditableCourse {
  return {
    title: course.title,
    steps: course.steps.map(deserializeCourseStep),
  };
}
