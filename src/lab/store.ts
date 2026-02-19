import { create } from "zustand";
import type {
  FsEntry,
  TerminalTab,
  TestRunState,
  ServiceStatus,
  ParsedLab,
  FileTreeNode,
  FileTreeDir,
} from "@/types/lab";
import { useSettingsStore } from "@/lab/settings-store";

// --- Close confirmation typestate ---

type CloseConfirmIdle = { readonly kind: "idle" };
type CloseConfirmPrompting = { readonly kind: "prompting"; readonly path: string };
export type CloseConfirmState = CloseConfirmIdle | CloseConfirmPrompting;


// Lab store — separate from presentation store. They never coexist.
// Single writer: only the lifecycle orchestrator mutates lifecycle state.
// Flat data structures. Tree derived via selector.
//
// INVARIANTS (must hold after every action):
//   I1: activePath ∈ openPaths ∨ activePath = undefined
//   I2: dirtyPaths ⊆ openPaths
//   I3: activeTerminalId ∈ terminalTabs.map(id) ∨ activeTerminalId = undefined
//   I4: lifecycle.lab is referentially stable (set once at construction)
//   I5: rightActivePath ∈ openPaths ∨ rightActivePath = undefined
//   I6: focusedPane = "right" ⟹ rightActivePath ≠ undefined
//   I7: rightActivePath ≠ activePath (same file cannot be in both panes)

export type FocusedPane = "left" | "right";

type LabStoreState = {
  readonly provisioningLog: readonly string[];
  readonly entries: readonly FsEntry[];
  readonly openPaths: readonly string[];
  readonly activePath: string | undefined;
  readonly rightActivePath: string | undefined;
  readonly focusedPane: FocusedPane;
  readonly dirtyPaths: ReadonlySet<string>;
  readonly terminalTabs: readonly TerminalTab[];
  readonly activeTerminalId: string | undefined;
  readonly testRun: TestRunState;
  readonly serviceStatuses: ReadonlyMap<string, ServiceStatus>;

  // Container panel
  readonly selectedService: string | undefined;
  readonly containerLogs: ReadonlyMap<string, readonly string[]>;

  // UI panels
  readonly paletteOpen: boolean;
  readonly paletteQuery: string;
  readonly paletteCommandMode: boolean;
  readonly shortcutsVisible: boolean;
  readonly goToLineOpen: boolean;
  readonly closeConfirm: CloseConfirmState;
};

type LabStoreActions = {
  appendLog: (line: string) => void;
  setEntries: (entries: readonly FsEntry[]) => void;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  markDirty: (path: string) => void;
  markClean: (path: string) => void;
  addTerminal: (tab: TerminalTab) => void;
  removeTerminal: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  renameTerminal: (id: string, title: string) => void;
  setTestRun: (state: TestRunState) => void;
  setServiceStatus: (name: string, status: ServiceStatus) => void;
  setSelectedService: (name: string | undefined) => void;
  appendContainerLog: (name: string, line: string) => void;
  clearContainerLogs: (name: string) => void;
  setPaletteOpen: (open: boolean) => void;
  setPaletteQuery: (query: string) => void;
  openPaletteCommands: () => void;
  setShortcutsVisible: (visible: boolean) => void;
  setGoToLineOpen: (open: boolean) => void;
  reorderTabs: (oldIndex: number, newIndex: number) => void;
  reorderTerminals: (oldIndex: number, newIndex: number) => void;
  splitRight: (path: string) => void;
  closeSplit: () => void;
  setFocusedPane: (pane: FocusedPane) => void;
  setRightActivePath: (path: string) => void;
  closeOthers: (path: string) => void;
  closeAll: () => void;
  closeSaved: () => void;
  promptClose: (path: string) => void;
  confirmClose: () => void;
  cancelClose: () => void;
  reset: () => void;
};

export type LabStore = LabStoreState & LabStoreActions;

function initialState(_lab: ParsedLab): LabStoreState {
  return {
    provisioningLog: [],
    entries: [],
    openPaths: [],
    activePath: undefined,
    rightActivePath: undefined,
    focusedPane: "left",
    dirtyPaths: new Set(),
    terminalTabs: [],
    activeTerminalId: undefined,
    testRun: { kind: "idle" },
    serviceStatuses: new Map(),
    selectedService: undefined,
    containerLogs: new Map(),
    paletteOpen: false,
    paletteQuery: "",
    paletteCommandMode: false,
    shortcutsVisible: false,
    goToLineOpen: false,
    closeConfirm: { kind: "idle" },
  };
}

// Factory: creates a fresh store per lab session.
export function createLabStore(lab: ParsedLab) {
  return create<LabStore>((set, get) => ({
    ...initialState(lab),

    appendLog: (line) => {
      set({ provisioningLog: [...get().provisioningLog, line] });
    },

    setEntries: (entries) => set({ entries }),

    // { true } openFile(p) { p ∈ openPaths ∧ focused pane activePath = p }
    // Routes to right pane when split is active and focused pane is right.
    // Enforces I7: if p is already active in the other pane, focus that pane instead.
    openFile: (path) => {
      const { openPaths, rightActivePath, focusedPane, activePath } = get();
      const inList = openPaths.includes(path);
      const nextOpen = inList ? openPaths : [...openPaths, path];

      // I7: can't have same file in both panes — if it's in the other pane, just focus there
      if (rightActivePath !== undefined && path === rightActivePath && focusedPane === "left") {
        set({ openPaths: nextOpen, focusedPane: "right" });
        return;
      }
      if (rightActivePath !== undefined && path === activePath && focusedPane === "right") {
        set({ openPaths: nextOpen, focusedPane: "left" });
        return;
      }

      if (rightActivePath !== undefined && focusedPane === "right") {
        set({ openPaths: nextOpen, rightActivePath: path });
      } else {
        set({ openPaths: nextOpen, activePath: path });
      }
    },

    // { p ∈ openPaths } closeFile(p) { p ∉ openPaths ∧ p ∉ dirtyPaths }
    // Handles split: closing the right pane's file clears the split (I5, I6).
    closeFile: (path) => {
      const { openPaths, activePath, rightActivePath, dirtyPaths } = get();
      const next = openPaths.filter((p) => p !== path);
      const nextDirty = new Set(dirtyPaths);
      nextDirty.delete(path);

      // I5: if right pane's file is closed, close the split
      const nextRight = rightActivePath === path ? undefined : rightActivePath;
      // I6: if split is gone, focus must return to left
      const nextFocused = nextRight === undefined ? "left" as const : get().focusedPane;

      const nextActive =
        activePath === path
          ? (next[Math.max(0, openPaths.indexOf(path) - 1)] ?? undefined)
          : activePath;

      // I7: if nextActive equals nextRight, clear the right pane
      const finalRight = nextRight !== undefined && nextRight === nextActive ? undefined : nextRight;
      const finalFocused = finalRight === undefined ? "left" as const : nextFocused;

      set({
        openPaths: next,
        activePath: nextActive,
        rightActivePath: finalRight,
        focusedPane: finalFocused,
        dirtyPaths: nextDirty,
      });
    },

    // Routes to focused pane. Enforces I7.
    setActiveFile: (path) => {
      const { rightActivePath, focusedPane, activePath } = get();
      if (rightActivePath !== undefined && focusedPane === "right") {
        // I7: can't set right to same as left
        if (path === activePath) {
          set({ focusedPane: "left" });
        } else {
          set({ rightActivePath: path });
        }
      } else {
        // I7: can't set left to same as right
        if (path === rightActivePath) {
          set({ focusedPane: "right" });
        } else {
          set({ activePath: path });
        }
      }
    },
    markDirty: (path) => {
      const next = new Set(get().dirtyPaths);
      next.add(path);
      set({ dirtyPaths: next });
    },
    markClean: (path) => {
      const next = new Set(get().dirtyPaths);
      next.delete(path);
      set({ dirtyPaths: next });
    },

    // { true } addTerminal(tab) { tab ∈ terminalTabs ∧ activeTerminalId = tab.id }
    addTerminal: (tab) => {
      set({
        terminalTabs: [...get().terminalTabs, tab],
        activeTerminalId: tab.id,
      });
    },

    // { id ∈ terminalTabs } removeTerminal(id) { id ∉ terminalTabs
    //   ∧ (activeTerminalId was id ⟹ activeTerminalId = prev_tab.id ∨ undefined) }
    // Same left-preference logic as closeFile.
    removeTerminal: (id) => {
      const { terminalTabs, activeTerminalId } = get();
      const next = terminalTabs.filter((t) => t.id !== id);
      const nextActive =
        activeTerminalId === id
          ? (next[Math.max(0, terminalTabs.findIndex((t) => t.id === id) - 1)]
              ?.id ?? undefined)
          : activeTerminalId;

      set({ terminalTabs: next, activeTerminalId: nextActive });
    },

    setActiveTerminal: (id) => set({ activeTerminalId: id }),

    renameTerminal: (id, title) => {
      set({
        terminalTabs: get().terminalTabs.map((t) =>
          t.id === id ? { ...t, title } : t,
        ),
      });
    },

    setTestRun: (testRun) => set({ testRun }),

    setServiceStatus: (name, status) => {
      const next = new Map(get().serviceStatuses);
      next.set(name, status);
      set({ serviceStatuses: next });
    },

    setSelectedService: (name) => set({ selectedService: name }),

    appendContainerLog: (name, line) => {
      const prev = get().containerLogs;
      const lines = prev.get(name) ?? [];
      // Cap at 2000 lines to bound memory
      const capped = lines.length >= 2000 ? lines.slice(-1999) : lines;
      const next = new Map(prev);
      next.set(name, [...capped, line]);
      set({ containerLogs: next });
    },

    clearContainerLogs: (name) => {
      const next = new Map(get().containerLogs);
      next.delete(name);
      set({ containerLogs: next });
    },

    setPaletteOpen: (open) => set({ paletteOpen: open, paletteCommandMode: false }),
    setPaletteQuery: (query) => set({ paletteQuery: query }),
    openPaletteCommands: () => set({ paletteOpen: true, paletteCommandMode: true }),
    setShortcutsVisible: (visible) => set({ shortcutsVisible: visible }),
    setGoToLineOpen: (open) => set({ goToLineOpen: open }),

    reorderTabs: (oldIndex, newIndex) => {
      const paths = [...get().openPaths];
      const [moved] = paths.splice(oldIndex, 1);
      if (moved !== undefined) {
        paths.splice(newIndex, 0, moved);
        set({ openPaths: paths });
      }
    },

    reorderTerminals: (oldIndex, newIndex) => {
      const tabs = [...get().terminalTabs];
      const [moved] = tabs.splice(oldIndex, 1);
      if (moved !== undefined) {
        tabs.splice(newIndex, 0, moved);
        set({ terminalTabs: tabs });
      }
    },

    closeOthers: (path) => {
      const { dirtyPaths } = get();
      const nextDirty = new Set<string>();
      if (dirtyPaths.has(path)) nextDirty.add(path);
      set({ openPaths: [path], activePath: path, rightActivePath: undefined, focusedPane: "left", dirtyPaths: nextDirty });
    },

    closeAll: () => {
      set({ openPaths: [], activePath: undefined, rightActivePath: undefined, focusedPane: "left", dirtyPaths: new Set() });
    },

    closeSaved: () => {
      const { openPaths, activePath, rightActivePath, dirtyPaths } = get();
      const nextOpen = openPaths.filter((p) => dirtyPaths.has(p));
      const nextActive = activePath !== undefined && dirtyPaths.has(activePath)
        ? activePath
        : (nextOpen[0] ?? undefined);
      const nextRight = rightActivePath !== undefined && nextOpen.includes(rightActivePath)
        ? rightActivePath
        : undefined;
      // I7: if both resolved to the same path, clear right
      const finalRight = nextRight !== undefined && nextRight === nextActive ? undefined : nextRight;
      set({ openPaths: nextOpen, activePath: nextActive, rightActivePath: finalRight, focusedPane: finalRight === undefined ? "left" : get().focusedPane });
    },

    // --- Split editor actions ---

    // { true } splitRight(p) { rightActivePath = p ∧ focusedPane = "right" ∧ p ∈ openPaths }
    // Enforces I7: if p is already activePath, swap it out of left first.
    splitRight: (path) => {
      const { openPaths, activePath } = get();
      const nextOpen = openPaths.includes(path) ? openPaths : [...openPaths, path];

      if (path === activePath) {
        // Move it to the right pane; left gets the previous neighbor
        const idx = nextOpen.indexOf(path);
        const nextLeft = nextOpen.filter((p) => p !== path);
        const leftActive = nextLeft[Math.max(0, idx - 1)] ?? undefined;
        set({ openPaths: nextOpen, activePath: leftActive, rightActivePath: path, focusedPane: "right" });
      } else {
        set({ openPaths: nextOpen, rightActivePath: path, focusedPane: "right" });
      }
    },

    closeSplit: () => {
      set({ rightActivePath: undefined, focusedPane: "left" });
    },

    // I6: no-op if no split and pane is "right"
    setFocusedPane: (pane) => {
      if (pane === "right" && get().rightActivePath === undefined) return;
      set({ focusedPane: pane });
    },

    setRightActivePath: (path) => {
      const { activePath, openPaths } = get();
      if (!openPaths.includes(path)) return;
      // I7: can't be same as left
      if (path === activePath) return;
      set({ rightActivePath: path });
    },

    // { path ∈ openPaths } promptClose(path) {
    //   path ∉ dirtyPaths ∨ suppress ⟹ closeFile(path)
    //   path ∈ dirtyPaths ∧ ¬suppress ⟹ closeConfirm = { kind: "prompting", path }
    // }
    promptClose: (path) => {
      const { dirtyPaths } = get();
      if (!dirtyPaths.has(path)) {
        get().closeFile(path);
        return;
      }
      if (useSettingsStore.getState().suppressCloseConfirm) {
        get().closeFile(path);
        return;
      }
      set({ closeConfirm: { kind: "prompting", path } });
    },

    // { closeConfirm.kind = "prompting" } confirmClose() {
    //   closeFile(path) ∧ closeConfirm = idle }
    confirmClose: () => {
      const { closeConfirm } = get();
      if (closeConfirm.kind !== "prompting") return;
      get().closeFile(closeConfirm.path);
      set({ closeConfirm: { kind: "idle" } });
    },

    cancelClose: () => set({ closeConfirm: { kind: "idle" } }),

    reset: () => set(initialState(lab)),
  }));
}

// --- Selectors ---

// { entries are flat, parentPath(e) derivable from e.path via lastIndexOf("/") }
// buildFileTree(entries, root)
// { result is a recursive tree rooted at root,
//   dirs sorted before files at each level, alpha within kind }
//
// Lazy children via getter — avoids forward-reference issues during
// single-pass construction. Each dir's children array is populated
// as subsequent entries reference it as parent.
export function buildFileTree(
  entries: readonly FsEntry[],
  rootPath: string,
): readonly FileTreeNode[] {
  const childrenMap = new Map<string, FileTreeNode[]>();

  childrenMap.set(rootPath, []);

  for (const entry of entries) {
    const parentPath = entry.path.substring(0, entry.path.lastIndexOf("/"));
    if (!childrenMap.has(parentPath)) {
      childrenMap.set(parentPath, []);
    }

    if (entry.kind === "dir") {
      childrenMap.set(entry.path, childrenMap.get(entry.path) ?? []);
      // Lazy getter: children resolve after the full loop populates childrenMap
      const dirNode: FileTreeDir = {
        kind: "dir",
        path: entry.path,
        name: entry.name,
        get children() {
          return childrenMap.get(entry.path) ?? [];
        },
      };
      childrenMap.get(parentPath)?.push(dirNode);
    } else {
      childrenMap.get(parentPath)?.push(entry);
    }
  }

  for (const [, children] of childrenMap) {
    children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  return childrenMap.get(rootPath) ?? [];
}
