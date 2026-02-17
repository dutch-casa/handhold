import { create } from "zustand";
import { load, save } from "@/lab/tauri/settings";
import type { AppSettings, EditorSettings, SidebarPanel } from "@/types/settings";
import { DEFAULT_SETTINGS } from "@/types/settings";

type SettingsActions = {
  setEditor: (editor: EditorSettings) => void;
  toggleVimMode: () => void;
  setSidebarPanel: (panel: SidebarPanel) => void;
  toggleSidebar: () => void;
  setSuppressCloseConfirm: (suppress: boolean) => void;
  hydrate: (settings: AppSettings) => void;
};

export type SettingsStore = AppSettings & SettingsActions;

function snapshot(state: SettingsStore): AppSettings {
  return {
    editor: state.editor,
    sidebarPanel: state.sidebarPanel,
    sidebarCollapsed: state.sidebarCollapsed,
    suppressCloseConfirm: state.suppressCloseConfirm,
  };
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,

  setEditor: (editor) => set({ editor }),

  toggleVimMode: () => {
    const { editor } = get();
    set({ editor: { ...editor, vimMode: !editor.vimMode } });
  },

  // Clicking a different panel uncollapses. Same panel toggles collapse.
  setSidebarPanel: (panel) => {
    const { sidebarPanel, sidebarCollapsed } = get();
    if (panel === sidebarPanel) {
      set({ sidebarCollapsed: !sidebarCollapsed });
    } else {
      set({ sidebarPanel: panel, sidebarCollapsed: false });
    }
  },

  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

  setSuppressCloseConfirm: (suppress) => set({ suppressCloseConfirm: suppress }),

  hydrate: (settings) => set(settings),
}));

// Auto-persist: write to disk on every state change (debounced by Zustand batching)
let persistEnabled = false;
useSettingsStore.subscribe((state) => {
  if (!persistEnabled) return;
  save(snapshot(state)).catch(() => {});
});

// Load from disk once, then enable persistence
export async function initSettings(): Promise<true> {
  try {
    const settings = await load();
    useSettingsStore.getState().hydrate(settings);
  } catch {
    // First launch or missing file — defaults are fine
  }
  persistEnabled = true;
  return true;
}
