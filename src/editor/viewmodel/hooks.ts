// Convenience hooks for the course editor store and scoped sub-stores.
// Each hook selects a narrow slice to minimize re-renders.
// useStepEditor / useBlockEditor are factory hooks: they create or retrieve
// stores scoped to a specific step ID or block name.

import { useRef } from "react";
import { type StoreApi, type UseBoundStore } from "zustand";
import {
  useCourseEditorStore,
  type CourseEditorStore,
  type CourseEditorStatus,
} from "@/editor/viewmodel/course-editor-store";
import type {
  EditorTab,
  EditorTabTarget,
  EditableStep,
  EditableBlock,
} from "@/editor/model/types";
import {
  createStepEditorStore,
  type StepEditorStore,
} from "@/editor/viewmodel/step-editor-store";
import {
  createBlockEditorStore,
  type BlockEditorStore,
} from "@/editor/viewmodel/block-editor-store";

// --- Course-level hooks ---

export function useCourseEditor(): CourseEditorStore {
  return useCourseEditorStore();
}

type EditorTabsSlice = {
  readonly tabs: readonly EditorTab[];
  readonly activeTabId: string | null;
  readonly activeTab: EditorTab | undefined;
  readonly openTab: (target: EditorTabTarget) => void;
  readonly closeTab: (tabId: string) => void;
  readonly activateTab: (tabId: string) => void;
};

export function useEditorTabs(): EditorTabsSlice {
  return useCourseEditorStore((s) => ({
    tabs: s.tabs,
    activeTabId: s.activeTabId,
    activeTab: s.activeTabId
      ? s.tabs.find((t) => t.id === s.activeTabId)
      : undefined,
    openTab: s.openTab,
    closeTab: s.closeTab,
    activateTab: s.activateTab,
  }));
}

export function useEditorStatus(): CourseEditorStatus {
  return useCourseEditorStore((s) => s.status);
}

type ViewModeSlice = {
  readonly viewMode: "visual" | "source";
  readonly toggleViewMode: () => void;
};

export function useEditorViewMode(): ViewModeSlice {
  return useCourseEditorStore((s) => ({
    viewMode: s.viewMode,
    toggleViewMode: s.toggleViewMode,
  }));
}

export function useEditorDirty(): boolean {
  return useCourseEditorStore((s) => s.tabs.some((t) => t.dirty));
}

// --- Scoped step editor hook ---
// Creates or retrieves a StepEditorStore for a given step.
// The store is cached by step.id and recreated if the step reference changes.

export function useStepEditor(step: EditableStep): UseBoundStore<StoreApi<StepEditorStore>> {
  const cacheRef = useRef<{ id: string; store: UseBoundStore<StoreApi<StepEditorStore>> } | null>(null);

  if (!cacheRef.current || cacheRef.current.id !== step.id) {
    cacheRef.current = {
      id: step.id,
      store: createStepEditorStore(step),
    };
  }

  return cacheRef.current.store;
}

// --- Scoped block editor hook ---
// Creates or retrieves a BlockEditorStore for a given block.
// Cached by block name + kind; recreated if the block reference changes identity.

export function useBlockEditor(block: EditableBlock): UseBoundStore<StoreApi<BlockEditorStore>> {
  const cacheRef = useRef<{
    name: string;
    kind: EditableBlock["kind"];
    store: UseBoundStore<StoreApi<BlockEditorStore>>;
  } | null>(null);

  if (!cacheRef.current || cacheRef.current.name !== block.name || cacheRef.current.kind !== block.kind) {
    cacheRef.current = {
      name: block.name,
      kind: block.kind,
      store: createBlockEditorStore(block),
    };
  }

  return cacheRef.current.store;
}
