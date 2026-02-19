import { create } from "zustand";
import type { ParsedLesson, LessonStep, SceneState } from "@/types/lesson";

// Presentation state. Single writer: only the playback orchestrator mutates.
// Components read via selectors.

export type PlaybackStatus = "idle" | "playing" | "paused";

type LoadLessonOpts = {
  readonly lesson: ParsedLesson;
  readonly initialStepIndex?: number | undefined;
  readonly completedSlideIds?: ReadonlySet<string> | undefined;
  readonly onStepChange?: ((index: number) => void) | undefined;
  readonly onSlideComplete?: ((slideId: string) => void) | undefined;
  readonly onLessonComplete?: (() => void) | undefined;
  readonly bundlePath?: string | undefined;
};

type PresentationState = {
  readonly lesson: ParsedLesson | null;
  readonly steps: readonly LessonStep[];
  readonly currentStepIndex: number;
  readonly status: PlaybackStatus;
  readonly playbackRate: number;
  readonly currentWordIndex: number;
  readonly sceneIndex: number;
  readonly completedStepIds: ReadonlySet<string>;
  readonly onStepChange: ((index: number) => void) | null;
  readonly onSlideComplete: ((slideId: string) => void) | null;
  readonly onLessonComplete: (() => void) | null;
  readonly bundlePath: string | undefined;
};

type PresentationActions = {
  loadLesson: (opts: LoadLessonOpts) => void;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (index: number) => void;
  setWordIndex: (index: number) => void;
  advanceScene: () => void;
  setSceneIndex: (index: number) => void;
  setPlaybackRate: (rate: number) => void;
  markStepComplete: (stepId: string) => void;
  reset: () => void;
};

export type PresentationStore = PresentationState & PresentationActions;

const INITIAL_STATE: PresentationState = {
  lesson: null,
  steps: [],
  currentStepIndex: 0,
  status: "idle",
  playbackRate: 1,
  currentWordIndex: -1,
  sceneIndex: 0,
  completedStepIds: new Set(),
  onStepChange: null,
  onSlideComplete: null,
  onLessonComplete: null,
  bundlePath: undefined,
};

export const usePresentationStore = create<PresentationStore>((set, get) => ({
  ...INITIAL_STATE,

  loadLesson: (opts) => {
    set({
      lesson: opts.lesson,
      steps: opts.lesson.steps,
      currentStepIndex: opts.initialStepIndex ?? 0,
      status: "idle",
      currentWordIndex: -1,
      sceneIndex: 0,
      completedStepIds: opts.completedSlideIds ?? new Set(),
      onStepChange: opts.onStepChange ?? null,
      onSlideComplete: opts.onSlideComplete ?? null,
      onLessonComplete: opts.onLessonComplete ?? null,
      bundlePath: opts.bundlePath,
    });
  },

  play: () => set({ status: "playing" }),

  pause: () => {
    if (get().status === "playing") {
      set({ status: "paused" });
    }
  },

  togglePlayPause: () => {
    const { status } = get();
    if (status === "playing") {
      set({ status: "paused" });
    } else {
      set({ status: "playing" });
    }
  },

  nextStep: () => {
    const { currentStepIndex, steps, onStepChange } = get();
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= steps.length) return;

    set({
      currentStepIndex: nextIndex,
      currentWordIndex: -1,
      sceneIndex: 0,
      status: "idle",
    });
    onStepChange?.(nextIndex);
  },

  prevStep: () => {
    const { currentStepIndex, onStepChange } = get();
    if (currentStepIndex <= 0) return;

    const prevIndex = currentStepIndex - 1;
    set({
      currentStepIndex: prevIndex,
      currentWordIndex: -1,
      sceneIndex: 0,
      status: "idle",
    });
    onStepChange?.(prevIndex);
  },

  goToStep: (index) => {
    const { steps, onStepChange } = get();
    if (index < 0 || index >= steps.length) return;

    set({
      currentStepIndex: index,
      currentWordIndex: -1,
      sceneIndex: 0,
      status: "idle",
    });
    onStepChange?.(index);
  },

  setWordIndex: (index) => set({ currentWordIndex: index }),

  advanceScene: () => {
    const { sceneIndex, currentStepIndex, steps } = get();
    const step = steps[currentStepIndex];
    if (!step) return;
    const maxScene = step.scenes.length - 1;
    if (sceneIndex < maxScene) {
      set({ sceneIndex: sceneIndex + 1 });
    }
  },

  setSceneIndex: (index) => set({ sceneIndex: index }),

  setPlaybackRate: (rate) => set({ playbackRate: rate }),

  markStepComplete: (stepId) => {
    const { completedStepIds, steps, onSlideComplete, onLessonComplete } = get();
    if (completedStepIds.has(stepId)) return;

    const completed = new Set(completedStepIds);
    completed.add(stepId);
    set({ completedStepIds: completed });

    onSlideComplete?.(stepId);

    if (completed.size === steps.length) {
      onLessonComplete?.();
    }
  },

  reset: () => set(INITIAL_STATE),
}));

// --- Selectors ---

export function useCurrentStep(): LessonStep | undefined {
  return usePresentationStore((s) => s.steps[s.currentStepIndex]);
}

export function useCurrentScene(): SceneState | undefined {
  return usePresentationStore((s) => {
    const step = s.steps[s.currentStepIndex];
    if (!step) return undefined;
    return step.scenes[s.sceneIndex];
  });
}

export function usePrevScene(): SceneState | undefined {
  return usePresentationStore((s) => {
    const step = s.steps[s.currentStepIndex];
    if (!step || s.sceneIndex <= 0) return undefined;
    return step.scenes[s.sceneIndex - 1];
  });
}

export function useCurrentStepNumber(): number {
  return usePresentationStore((s) => s.currentStepIndex + 1);
}

export function useTotalSteps(): number {
  return usePresentationStore((s) => s.steps.length);
}
