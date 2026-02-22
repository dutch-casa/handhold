// Convenience hooks for the course editor store.
// Each hook selects a narrow slice to minimize re-renders.

import {
  useCourseEditorStore,
  type CourseEditorStore,
  type CourseEditorStatus,
} from "@/editor/viewmodel/course-editor-store";
import type { EditorTab, EditorTabTarget } from "@/editor/model/types";

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
