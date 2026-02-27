// Course editor store. Manages course loading, tab system, view mode, undo/redo,
// and course structure mutations. Single deep module — all actions in one create().
// Pattern: State (readonly) + Actions (named transitions). Views select, never set.

import { create } from "zustand";
import { EditHistory } from "@/editor/model/editable";
import {
  tabId,
  tabLabel,
  type EditableCourse,
  type EditableCourseStep,
  type EditorTab,
  type EditorTabTarget,
} from "@/editor/model/types";

export type CourseEditorStatus =
  | { readonly kind: "loading" }
  | { readonly kind: "ready" }
  | { readonly kind: "saving" }
  | { readonly kind: "error"; readonly message: string };

type CourseEditorState = {
  readonly status: CourseEditorStatus;
  readonly course: EditableCourse | null;
  readonly tabs: readonly EditorTab[];
  readonly activeTabId: string | null;
  readonly viewMode: "visual" | "source";
  readonly history: EditHistory;
};

type CourseEditorActions = {
  loadCourse(courseId: string): Promise<void>;
  save(): Promise<void>;

  openTab(target: EditorTabTarget): void;
  closeTab(tabId: string): void;
  activateTab(tabId: string): void;

  toggleViewMode(): void;

  undo(): void;
  redo(): void;

  addLesson(title: string): void;
  addLab(title: string): void;
  removeStep(stepId: string): void;
  moveStep(fromIndex: number, toIndex: number): void;
  renameStep(stepId: string, title: string): void;
};

export type CourseEditorStore = CourseEditorState & CourseEditorActions;

const INITIAL_STATE: CourseEditorState = {
  status: { kind: "loading" },
  course: null,
  tabs: [],
  activeTabId: null,
  viewMode: "visual",
  history: new EditHistory(),
};

export const useCourseEditorStore = create<CourseEditorStore>((set, get) => ({
  ...INITIAL_STATE,

  loadCourse: async (_courseId: string) => {
    set({ status: { kind: "loading" } });
    // Placeholder: actual Tauri invoke wired later.
    // Simulate async boundary so callers treat this as async from the start.
    await Promise.resolve();
    set({
      status: { kind: "ready" },
      course: { title: "", steps: [] },
      tabs: [],
      activeTabId: null,
      history: new EditHistory(),
    });
  },

  save: async () => {
    set({ status: { kind: "saving" } });
    // Placeholder: actual serialization + Tauri write_file wired later.
    await Promise.resolve();
    set({ status: { kind: "ready" } });
  },

  openTab: (target) => {
    const id = tabId(target);
    const { tabs } = get();
    const existing = tabs.find((t) => t.id === id);
    if (existing) {
      set({ activeTabId: id });
      return;
    }

    const tab: EditorTab = {
      id,
      target,
      label: tabLabel(target),
      dirty: false,
      pinned: false,
    };
    set({ tabs: [...tabs, tab], activeTabId: id });
  },

  closeTab: (closingId) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === closingId);
    if (idx === -1) return;

    const next = tabs.filter((t) => t.id !== closingId);

    // If closing the active tab, activate an adjacent tab or null.
    let nextActive = activeTabId;
    if (activeTabId === closingId) {
      const neighbor = next[Math.min(idx, next.length - 1)];
      nextActive = neighbor?.id ?? null;
    }

    set({ tabs: next, activeTabId: nextActive });
  },

  activateTab: (id) => {
    const { tabs } = get();
    if (tabs.some((t) => t.id === id)) {
      set({ activeTabId: id });
    }
  },

  toggleViewMode: () => {
    set((s) => ({
      viewMode: s.viewMode === "visual" ? "source" : "visual",
    }));
  },

  undo: () => {
    const { history, course } = get();
    if (!course) return;
    history.undo();
    // Force re-render by spreading a fresh course reference.
    set({ course: { ...course } });
  },

  redo: () => {
    const { history, course } = get();
    if (!course) return;
    history.redo();
    set({ course: { ...course } });
  },

  addLesson: (title) => {
    const { course, history } = get();
    if (!course) return;

    const lesson: EditableCourseStep = {
      kind: "lesson",
      id: crypto.randomUUID(),
      title,
      steps: [],
    };

    history.push({
      description: `Add lesson "${title}"`,
      forward: () => course.steps.push(lesson),
      reverse: () => {
        course.steps.pop();
      },
    });
    set({ course: { ...course } });
  },

  addLab: (title) => {
    const { course, history } = get();
    if (!course) return;

    const lab: EditableCourseStep = {
      kind: "lab",
      id: crypto.randomUUID(),
      title,
      lab: {
        title,
        instructions: "",
        workspace: "fresh",
        testCommand: "",
        openFiles: [],
        services: [],
        setup: [],
        scaffoldPath: "",
      },
    };

    history.push({
      description: `Add lab "${title}"`,
      forward: () => course.steps.push(lab),
      reverse: () => {
        course.steps.pop();
      },
    });
    set({ course: { ...course } });
  },

  removeStep: (stepId) => {
    const { course, history } = get();
    if (!course) return;

    const idx = course.steps.findIndex((s) => s.id === stepId);
    if (idx === -1) return;

    const removed = course.steps[idx]!;
    history.push({
      description: `Remove step "${removed.title}"`,
      forward: () => {
        course.steps.splice(idx, 1);
      },
      reverse: () => {
        course.steps.splice(idx, 0, removed);
      },
    });
    set({ course: { ...course } });
  },

  moveStep: (fromIndex, toIndex) => {
    const { course, history } = get();
    if (!course) return;
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || fromIndex >= course.steps.length) return;
    if (toIndex < 0 || toIndex >= course.steps.length) return;

    history.push({
      description: `Move step from ${fromIndex} to ${toIndex}`,
      forward: () => {
        const [step] = course.steps.splice(fromIndex, 1);
        course.steps.splice(toIndex, 0, step!);
      },
      reverse: () => {
        const [step] = course.steps.splice(toIndex, 1);
        course.steps.splice(fromIndex, 0, step!);
      },
    });
    set({ course: { ...course } });
  },

  renameStep: (stepId, title) => {
    const { course, history } = get();
    if (!course) return;

    const step = course.steps.find((s) => s.id === stepId);
    if (!step) return;

    const oldTitle = step.title;
    history.push({
      description: `Rename step "${oldTitle}" to "${title}"`,
      forward: () => {
        step.title = title;
      },
      reverse: () => {
        step.title = oldTitle;
      },
    });
    set({ course: { ...course } });
  },
}));

// --- Selectors ---

export function useEditorActiveTab(): EditorTab | undefined {
  return useCourseEditorStore((s) => {
    if (!s.activeTabId) return undefined;
    return s.tabs.find((t) => t.id === s.activeTabId);
  });
}

export function useEditorDirtySelector(): boolean {
  return useCourseEditorStore((s) => s.tabs.some((t) => t.dirty));
}

export function useEditorCanUndo(): boolean {
  return useCourseEditorStore((s) => s.history.canUndo);
}

export function useEditorCanRedo(): boolean {
  return useCourseEditorStore((s) => s.history.canRedo);
}

export function useEditorCourse(): EditableCourse | null {
  return useCourseEditorStore((s) => s.course);
}

export function useEditorSteps(): readonly EditableCourseStep[] {
  return useCourseEditorStore((s) => s.course?.steps ?? []);
}
