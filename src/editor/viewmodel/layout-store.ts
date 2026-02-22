// Layout store — governs the responsive 3-column editor shell.
// Single writer: only Layout's ResizeObserver and resize handles mutate.
//
// INVARIANTS:
//   L1: sidebarWidth >= SIDEBAR_MIN && sidebarWidth <= maxSidebar (40% container)
//   L2: panelWidth >= PANEL_MIN && panelWidth <= maxPanel (40% container)
//   L3: bottomBarHeight >= BOTTOM_BAR_MIN
//   L4: breakpoint "sm" => sidebar hidden, panel hidden
//   L5: breakpoint "md" => panel hidden (unless toggled)
//   L6: sidebarVisible = false => sidebar unmounted

import { create } from "zustand";

export type SidebarSection = "course" | "blocks" | "regions" | "diagnostics";
export type PanelTab = "agent" | "inspector";
export type BottomBarTab = "timeline" | "preview" | "diagnostics";
export type Breakpoint = "sm" | "md" | "lg" | "xl";

export const SIDEBAR_MIN = 200;
export const PANEL_MIN = 280;
export const BOTTOM_BAR_MIN = 120;
export const SIDEBAR_DEFAULT = 260;
export const PANEL_DEFAULT = 320;
export const BOTTOM_BAR_DEFAULT = 200;

type LayoutState = {
  readonly breakpoint: Breakpoint;
  readonly sidebarVisible: boolean;
  readonly sidebarWidth: number;
  readonly sidebarSection: SidebarSection;
  readonly panelVisible: boolean;
  readonly panelWidth: number;
  readonly panelTab: PanelTab;
  readonly bottomBarVisible: boolean;
  readonly bottomBarHeight: number;
  readonly bottomBarTab: BottomBarTab;
};

type LayoutActions = {
  setBreakpoint: (bp: Breakpoint) => void;
  toggleSidebar: () => void;
  setSidebarVisible: (v: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setSidebarSection: (section: SidebarSection) => void;
  togglePanel: () => void;
  setPanelVisible: (v: boolean) => void;
  setPanelWidth: (w: number) => void;
  setPanelTab: (tab: PanelTab) => void;
  toggleBottomBar: () => void;
  setBottomBarVisible: (v: boolean) => void;
  setBottomBarHeight: (h: number) => void;
  setBottomBarTab: (tab: BottomBarTab) => void;
};

export type LayoutStore = LayoutState & LayoutActions;

const INITIAL: LayoutState = {
  breakpoint: "lg",
  sidebarVisible: true,
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarSection: "course",
  panelVisible: true,
  panelWidth: PANEL_DEFAULT,
  panelTab: "agent",
  bottomBarVisible: false,
  bottomBarHeight: BOTTOM_BAR_DEFAULT,
  bottomBarTab: "timeline",
};

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  ...INITIAL,

  setBreakpoint: (bp) => {
    const prev = get().breakpoint;
    if (bp === prev) return;

    // L4, L5: auto-collapse on breakpoint drop
    if (bp === "sm") {
      set({ breakpoint: bp, sidebarVisible: false, panelVisible: false });
    } else if (bp === "md") {
      set({
        breakpoint: bp,
        panelVisible: false,
        ...(prev === "sm" ? { sidebarVisible: true } : {}),
      });
    } else if (prev === "sm" || prev === "md") {
      set({ breakpoint: bp, sidebarVisible: true, panelVisible: true });
    } else {
      set({ breakpoint: bp });
    }
  },

  toggleSidebar: () => set({ sidebarVisible: !get().sidebarVisible }),
  setSidebarVisible: (v) => set({ sidebarVisible: v }),

  setSidebarWidth: (w) => {
    set({ sidebarWidth: Math.max(SIDEBAR_MIN, w) });
  },

  setSidebarSection: (section) => {
    set({ sidebarSection: section, sidebarVisible: true });
  },

  togglePanel: () => set({ panelVisible: !get().panelVisible }),
  setPanelVisible: (v) => set({ panelVisible: v }),

  setPanelWidth: (w) => {
    set({ panelWidth: Math.max(PANEL_MIN, w) });
  },

  setPanelTab: (tab) => {
    set({ panelTab: tab, panelVisible: true });
  },

  toggleBottomBar: () => set({ bottomBarVisible: !get().bottomBarVisible }),
  setBottomBarVisible: (v) => set({ bottomBarVisible: v }),

  setBottomBarHeight: (h) => {
    set({ bottomBarHeight: Math.max(BOTTOM_BAR_MIN, h) });
  },

  setBottomBarTab: (tab) => {
    set({ bottomBarTab: tab, bottomBarVisible: true });
  },
}));

// --- Selectors ---

export function useBreakpoint(): Breakpoint {
  return useLayoutStore((s) => s.breakpoint);
}

export function useSidebarState() {
  return useLayoutStore((s) => ({
    visible: s.sidebarVisible,
    width: s.sidebarWidth,
    section: s.sidebarSection,
  }));
}

export function usePanelState() {
  return useLayoutStore((s) => ({
    visible: s.panelVisible,
    width: s.panelWidth,
    tab: s.panelTab,
  }));
}

export function useBottomBarState() {
  return useLayoutStore((s) => ({
    visible: s.bottomBarVisible,
    height: s.bottomBarHeight,
    tab: s.bottomBarTab,
  }));
}

export function getBreakpoint(width: number): Breakpoint {
  if (width < 1024) return "sm";
  if (width < 1440) return "md";
  if (width < 1920) return "lg";
  return "xl";
}
