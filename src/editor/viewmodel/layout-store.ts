// Editor layout state. Manages sidebar, panel, bottom bar, and breakpoint.
// Pattern: State (readonly) + Actions (named transitions). Views select, never set.

import { create } from "zustand";

export type SidebarSection = "course" | "blocks" | "regions" | "diagnostics";
export type PanelTab = "agent" | "inspector";
export type BottomBarTab = "timeline" | "preview" | "diagnostics";
export type Breakpoint = "sm" | "md" | "lg" | "xl";

type LayoutState = {
  readonly sidebar: {
    readonly visible: boolean;
    readonly width: number;
    readonly activeSection: SidebarSection;
  };
  readonly panel: {
    readonly visible: boolean;
    readonly width: number;
    readonly activeTab: PanelTab;
  };
  readonly bottomBar: {
    readonly visible: boolean;
    readonly height: number;
    readonly activeTab: BottomBarTab;
  };
  readonly breakpoint: Breakpoint;
};

type LayoutActions = {
  toggleSidebar: () => void;
  setSidebarWidth: (width: number) => void;
  setSidebarSection: (section: SidebarSection) => void;
  togglePanel: () => void;
  setPanelWidth: (width: number) => void;
  setPanelTab: (tab: PanelTab) => void;
  toggleBottomBar: () => void;
  setBottomBarHeight: (height: number) => void;
  setBottomBarTab: (tab: BottomBarTab) => void;
  setBreakpoint: (bp: Breakpoint) => void;
};

export type LayoutStore = LayoutState & LayoutActions;

const INITIAL_STATE: LayoutState = {
  sidebar: { visible: true, width: 260, activeSection: "course" },
  panel: { visible: false, width: 320, activeTab: "agent" },
  bottomBar: { visible: false, height: 240, activeTab: "timeline" },
  breakpoint: "lg",
};

export const useLayoutStore = create<LayoutStore>((set) => ({
  ...INITIAL_STATE,

  toggleSidebar: () =>
    set((s) => ({
      sidebar: { ...s.sidebar, visible: !s.sidebar.visible },
    })),

  setSidebarWidth: (width) =>
    set((s) => ({ sidebar: { ...s.sidebar, width } })),

  setSidebarSection: (section) =>
    set((s) => ({
      sidebar: { ...s.sidebar, activeSection: section, visible: true },
    })),

  togglePanel: () =>
    set((s) => ({
      panel: { ...s.panel, visible: !s.panel.visible },
    })),

  setPanelWidth: (width) =>
    set((s) => ({ panel: { ...s.panel, width } })),

  setPanelTab: (tab) =>
    set((s) => ({
      panel: { ...s.panel, activeTab: tab, visible: true },
    })),

  toggleBottomBar: () =>
    set((s) => ({
      bottomBar: { ...s.bottomBar, visible: !s.bottomBar.visible },
    })),

  setBottomBarHeight: (height) =>
    set((s) => ({ bottomBar: { ...s.bottomBar, height } })),

  setBottomBarTab: (tab) =>
    set((s) => ({
      bottomBar: { ...s.bottomBar, activeTab: tab, visible: true },
    })),

  setBreakpoint: (bp) => set({ breakpoint: bp }),
}));

// --- Selectors ---

export function useSidebarVisible(): boolean {
  return useLayoutStore((s) => s.sidebar.visible);
}

export function useSidebarSection(): SidebarSection {
  return useLayoutStore((s) => s.sidebar.activeSection);
}

export function usePanelVisible(): boolean {
  return useLayoutStore((s) => s.panel.visible);
}

export function usePanelTab(): PanelTab {
  return useLayoutStore((s) => s.panel.activeTab);
}

export function useBottomBarVisible(): boolean {
  return useLayoutStore((s) => s.bottomBar.visible);
}

export function useBottomBarTab(): BottomBarTab {
  return useLayoutStore((s) => s.bottomBar.activeTab);
}

export function useBreakpoint(): Breakpoint {
  return useLayoutStore((s) => s.breakpoint);
}
