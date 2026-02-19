import { useCallback, useMemo, useRef } from "react";
import type { editor as monacoEditor } from "monaco-editor";
import { useStore } from "zustand";
import { createLabStore, type CloseConfirmState, type FocusedPane } from "@/lab/store";
import { useFileTree } from "@/lab/use-file-tree";
import { useTerminals } from "@/lab/use-terminals";
import { useFile } from "@/lab/use-file";
import { useFileOps, type FileOps } from "@/lab/use-file-ops";
import { useLifecycle } from "@/lab/use-lifecycle";
import { useTestRunner } from "@/lab/use-test-runner";
import { useGitDiff } from "@/lab/use-git-diff";
import { useMonacoModels } from "@/lab/use-monaco-models";
import { useContainers } from "@/lab/use-containers";
import { useLsp } from "@/lab/lsp/use-lsp";
import { useSettingsStore } from "@/lab/settings-store";
import { getFileIcon } from "@/lab/file-icons";
import type {
  ParsedLab,
  FileTreeNode,
  LabLifecycle,
  TestRunState,
} from "@/types/lab";
import type { LineChange } from "@/lab/tauri/git";
import type { TerminalHandle, SpawnOpts } from "@/lab/tauri/terminal";
import type { ServicePanelProps } from "@/lab/ServicePanel";
import type { LucideIcon } from "lucide-react";

// Deep module: simple interface, complex internals.
// One hook → one shaped object → view renders it directly.
// All derivation happens here. Views do zero computation.

// --- Pre-computed view types ---

export type EditorTabView = {
  readonly path: string;
  readonly name: string;
  readonly ext: string;
  readonly icon: LucideIcon;
  readonly iconColor: string;
  readonly dirty: boolean;
  readonly active: boolean;
  readonly pane: "left" | "right" | undefined;
};

export type TerminalTabView = {
  readonly id: string;
  readonly title: string;
  readonly active: boolean;
};

// --- Return type slices ---

export type LabFilesSlice = {
  readonly tree: readonly FileTreeNode[];
  readonly loading: boolean;
  readonly rootPath: string;
  readonly select: (path: string) => void;
  readonly ops: FileOps;
  readonly refresh: () => void;
};

export type LabEditorSlice = {
  readonly tabs: readonly EditorTabView[];
  readonly activePath: string | undefined;
  readonly content: string | undefined;
  readonly contentLoading: boolean;
  readonly breadcrumbs: readonly string[];
  readonly gitChanges: readonly LineChange[];
  readonly rightActivePath: string | undefined;
  readonly rightContent: string | undefined;
  readonly rightContentLoading: boolean;
  readonly rightBreadcrumbs: readonly string[];
  readonly rightGitChanges: readonly LineChange[];
  readonly focusedPane: FocusedPane;
  readonly fontSize: number;
  readonly tabSize: number;
  readonly vimMode: boolean;
  readonly open: (path: string) => void;
  readonly close: (path: string) => void;
  readonly select: (path: string) => void;
  readonly save: () => Promise<void>;
  readonly saveContent: (path: string, content: string) => Promise<void>;
  readonly markDirty: (path: string, content: string) => void;
  readonly closeOthers: (path: string) => void;
  readonly closeAll: () => void;
  readonly closeSaved: () => void;
  readonly reorderTabs: (oldIndex: number, newIndex: number) => void;
  readonly goToLine: (line: number) => void;
  readonly openAt: (path: string, line: number, column: number) => void;
  readonly setEditorInstance: (path: string, editor: monacoEditor.IStandaloneCodeEditor | null) => void;
  readonly splitRight: (path: string) => void;
  readonly closeSplit: () => void;
  readonly setFocusedPane: (pane: FocusedPane) => void;
};

export type LabTerminalSlice = {
  readonly tabs: readonly TerminalTabView[];
  readonly spawn: (opts?: SpawnOpts) => Promise<TerminalHandle>;
  readonly close: (id: string) => Promise<void>;
  readonly select: (id: string) => void;
  readonly rename: (id: string, title: string) => void;
  readonly reorderTerminals: (oldIndex: number, newIndex: number) => void;
  readonly getHandle: (id: string) => TerminalHandle | undefined;
};

export type LabStatusSlice = {
  readonly title: string;
  readonly lifecycle: LabLifecycle;
};

export type LabTestSlice = {
  readonly testRun: TestRunState;
  readonly run: () => Promise<void>;
};

export type LabUiSlice = {
  readonly closeConfirm: CloseConfirmState;
  readonly paletteOpen: boolean;
  readonly paletteCommandMode: boolean;
  readonly shortcutsVisible: boolean;
  readonly goToLineOpen: boolean;
  readonly requestClose: (path: string) => void;
  readonly confirmClose: () => void;
  readonly confirmSaveAndClose: () => void;
  readonly cancelClose: () => void;
  readonly setPaletteOpen: (open: boolean) => void;
  readonly openPaletteCommands: () => void;
  readonly setShortcutsVisible: (visible: boolean) => void;
  readonly setGoToLineOpen: (open: boolean) => void;
};

export type Lab = {
  readonly files: LabFilesSlice;
  readonly editor: LabEditorSlice;
  readonly terminal: LabTerminalSlice;
  readonly test: LabTestSlice;
  readonly services: ServicePanelProps;
  readonly status: LabStatusSlice;
  readonly instructions: string;
  readonly ui: LabUiSlice;
};

// --- Pure helpers ---

function nameFromPath(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

function extFromName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1);
}

function breadcrumbsFromPath(
  activePath: string | undefined,
  workspacePath: string,
): readonly string[] {
  if (activePath === undefined) return [];
  const relative = activePath.startsWith(workspacePath)
    ? activePath.slice(workspacePath.length + 1)
    : activePath;
  return relative.split("/").filter(Boolean);
}

// --- The hook ---

export function useLab(manifest: ParsedLab, workspacePath: string): Lab {
  const store = useMemo(() => createLabStore(manifest), [manifest]);

  // State — subscribe to full store. Lab.tsx is the sole consumer;
  // fine-grained selectors add complexity without measurable benefit.
  const state = useStore(store);

  // Terminal PTY handles
  const terminals = useTerminals({
    workspacePath,
    addTab: state.addTerminal,
    removeTab: state.removeTerminal,
    setActive: state.setActiveTerminal,
  });

  // Lifecycle: React Query drives scaffold → setup → services → ready.
  // Post-provisioning init (open files, spawn terminal) runs inside queryFn
  // so we don't need separate useEffects with ref guards.
  const rawLifecycle = useLifecycle(
    manifest,
    workspacePath,
    {
      appendLog: state.appendLog,
      setServiceStatus: state.setServiceStatus,
    },
    {
      openInitialFiles: () => {
        for (const file of manifest.openFiles) {
          state.openFile(`${workspacePath}/${file}`);
        }
      },
      spawnTerminal: () => { terminals.spawnTerminal(); },
    },
  );

  // Enrich provisioning lifecycle with streaming log from store
  const lifecycle: LabLifecycle =
    rawLifecycle.kind === "provisioning"
      ? { ...rawLifecycle, log: state.provisioningLog }
      : rawLifecycle;

  // File tree via React Query + fs watcher
  const { tree, loading: treeLoading, refresh: refreshTree } = useFileTree(workspacePath);

  // File CRUD with automatic cache invalidation
  const fileOps = useFileOps(workspacePath);

  // Active file content via React Query — one per pane
  const { content, save: saveFileLeft, loading: contentLoading } = useFile(state.activePath);
  const { content: rightContent, save: saveFileRight, loading: rightContentLoading } = useFile(state.rightActivePath);

  // Live editor content — keyed by file path, both panes write here.
  const liveContentMap = useRef(new Map<string, string>());

  // Monaco editor instances — keyed by file path, each pane registers here.
  const editorInstanceMap = useRef(new Map<string, monacoEditor.IStandaloneCodeEditor>());

  const setEditorInstance = useCallback((path: string, ed: monacoEditor.IStandaloneCodeEditor | null) => {
    if (ed) {
      editorInstanceMap.current.set(path, ed);
    } else {
      editorInstanceMap.current.delete(path);
    }
  }, []);

  // Resolve the focused pane's active path
  const focusedPath = state.focusedPane === "right" ? state.rightActivePath : state.activePath;

  const goToLine = useCallback((line: number) => {
    const path = focusedPath;
    if (!path) return;
    const ed = editorInstanceMap.current.get(path);
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;
    const clamped = Math.max(1, Math.min(line, model.getLineCount()));
    ed.setPosition({ lineNumber: clamped, column: 1 });
    ed.revealLineInCenter(clamped);
    ed.focus();
  }, [focusedPath]);

  const openAt = useCallback((path: string, line: number, column: number) => {
    state.openFile(path);
    requestAnimationFrame(() => {
      const ed = editorInstanceMap.current.get(path);
      if (!ed) return;
      const model = ed.getModel();
      if (!model) return;
      const clampedLine = Math.max(1, Math.min(line, model.getLineCount()));
      ed.setPosition({ lineNumber: clampedLine, column });
      ed.revealLineInCenter(clampedLine);
      ed.focus();
    });
  }, [state.openFile]);

  // Seed Monaco models for cross-file IntelliSense
  useMonacoModels(workspacePath);

  // LSP support for non-TypeScript languages (auto-detected from "dev" service)
  const devContainer = manifest.services.find(s => s.name === "dev")?.name;
  useLsp({
    containerName: devContainer,
    rootUri: `file://${workspacePath}`,
    enabled: lifecycle.kind === "ready" && devContainer !== undefined,
  });

  // Git gutter markers — one per pane
  const gitChanges = useGitDiff(state.activePath, workspacePath);
  const rightGitChanges = useGitDiff(state.rightActivePath, workspacePath);

  // Editor settings from persisted store
  const { vimMode, fontSize, tabSize } = useSettingsStore((s) => s.editor);

  // Test runner
  const testRunner = useTestRunner(manifest.testCommand, workspacePath, {
    setTestRun: state.setTestRun,
  });

  // Container orchestration — runtime detection, polling, log streaming
  const composePath = `${workspacePath}/docker-compose.yml`;
  const containersResult = useContainers({
    composePath,
    enabled: lifecycle.kind === "ready",
    serviceCount: manifest.services.length,
    selectedService: state.selectedService,
    store: {
      appendContainerLog: state.appendContainerLog,
      clearContainerLogs: state.clearContainerLogs,
    },
  });

  // Exec into container — spawns a PTY with the runtime binary
  const execIntoContainer = useCallback(
    async (containerName: string) => {
      if (containersResult.runtime.kind !== "ready") return;
      const { binary } = containersResult.runtime;
      await terminals.spawnTerminal({
        shell: binary,
        args: ["exec", "-it", containerName, "/bin/sh"],
      });
    },
    [containersResult.runtime, terminals.spawnTerminal],
  );

  // --- Pre-computed view data ---

  const editorTabs: readonly EditorTabView[] = useMemo(() => {
    const { openPaths, activePath, rightActivePath, dirtyPaths } = state;
    return openPaths.map((path) => {
      const name = nameFromPath(path);
      const ext = extFromName(name);
      const { icon, color } = getFileIcon(name, ext);
      const pane = path === activePath ? "left" as const
        : path === rightActivePath ? "right" as const
        : undefined;
      return {
        path,
        name,
        ext,
        icon,
        iconColor: color,
        dirty: dirtyPaths.has(path),
        active: path === activePath || path === rightActivePath,
        pane,
      };
    });
  }, [state.openPaths, state.activePath, state.rightActivePath, state.dirtyPaths]);

  const breadcrumbs = useMemo(
    () => breadcrumbsFromPath(state.activePath, workspacePath),
    [state.activePath, workspacePath],
  );

  const rightBreadcrumbs = useMemo(
    () => breadcrumbsFromPath(state.rightActivePath, workspacePath),
    [state.rightActivePath, workspacePath],
  );

  const terminalTabs: readonly TerminalTabView[] = useMemo(
    () =>
      state.terminalTabs.map((t) => ({
        id: t.id,
        title: t.title,
        active: t.id === state.activeTerminalId,
      })),
    [state.terminalTabs, state.activeTerminalId],
  );

  // Resolve the save function for a given path (routes to correct pane's React Query).
  const saveToDisk = useCallback(
    async (path: string, text: string) => {
      if (path === state.activePath) {
        await saveFileLeft(text);
      } else if (path === state.rightActivePath) {
        await saveFileRight(text);
      }
    },
    [state.activePath, state.rightActivePath, saveFileLeft, saveFileRight],
  );

  // Writes the given content to disk and clears dirty state.
  const saveContent = useCallback(
    async (path: string, text: string) => {
      await saveToDisk(path, text);
      liveContentMap.current.set(path, text);
      state.markClean(path);
    },
    [saveToDisk, state.markClean],
  );

  // Saves the focused pane's live content.
  const save = useCallback(
    async () => {
      const path = focusedPath;
      if (!path) return;
      const cached = path === state.activePath ? content : rightContent;
      const toSave = liveContentMap.current.get(path) ?? cached;
      if (toSave === undefined) return;
      await saveContent(path, toSave);
    },
    [focusedPath, state.activePath, content, rightContent, saveContent],
  );

  // Captures live editor content and marks the file dirty.
  const markDirty = useCallback((path: string, liveContent: string) => {
    liveContentMap.current.set(path, liveContent);
    state.markDirty(path);
  }, [state.markDirty]);

  // Composed: save the file being prompted about, then close it.
  const confirmSaveAndClose = useCallback(async () => {
    const { closeConfirm } = state;
    if (closeConfirm.kind !== "prompting") return;
    const { path } = closeConfirm;
    const cached = path === state.activePath ? content : rightContent;
    const toSave = liveContentMap.current.get(path) ?? cached;
    if (toSave !== undefined) {
      await saveToDisk(path, toSave);
      state.markClean(path);
    }
    state.closeFile(path);
    state.cancelClose();
  }, [state.closeConfirm, state.activePath, content, rightContent, saveToDisk, state.markClean, state.closeFile, state.cancelClose]);

  return {
    files: {
      tree,
      loading: treeLoading,
      rootPath: workspacePath,
      select: state.openFile,
      ops: fileOps,
      refresh: refreshTree,
    },
    editor: {
      tabs: editorTabs,
      activePath: state.activePath,
      content,
      contentLoading,
      breadcrumbs,
      gitChanges,
      rightActivePath: state.rightActivePath,
      rightContent,
      rightContentLoading,
      rightBreadcrumbs,
      rightGitChanges,
      focusedPane: state.focusedPane,
      fontSize,
      tabSize,
      vimMode,
      open: state.openFile,
      close: state.closeFile,
      select: state.setActiveFile,
      save,
      saveContent,
      markDirty,
      closeOthers: state.closeOthers,
      closeAll: state.closeAll,
      closeSaved: state.closeSaved,
      reorderTabs: state.reorderTabs,
      goToLine,
      openAt,
      setEditorInstance,
      splitRight: state.splitRight,
      closeSplit: state.closeSplit,
      setFocusedPane: state.setFocusedPane,
    },
    terminal: {
      tabs: terminalTabs,
      spawn: terminals.spawnTerminal,
      close: terminals.closeTerminal,
      select: state.setActiveTerminal,
      rename: state.renameTerminal,
      reorderTerminals: state.reorderTerminals,
      getHandle: terminals.getHandle,
    },
    test: {
      testRun: state.testRun,
      run: testRunner.run,
    },
    services: {
      runtime: containersResult.runtime,
      containers: containersResult.containers,
      selected: state.selectedService,
      logs: state.containerLogs.get(state.selectedService ?? "") ?? [],
      serviceCount: manifest.services.length,
      onSelect: state.setSelectedService,
      onAction: containersResult.performAction,
      onExec: execIntoContainer,
    },
    status: {
      title: manifest.title,
      lifecycle,
    },
    instructions: manifest.instructions,
    ui: {
      closeConfirm: state.closeConfirm,
      paletteOpen: state.paletteOpen,
      paletteCommandMode: state.paletteCommandMode,
      shortcutsVisible: state.shortcutsVisible,
      requestClose: state.promptClose,
      confirmClose: state.confirmClose,
      confirmSaveAndClose,
      cancelClose: state.cancelClose,
      setPaletteOpen: state.setPaletteOpen,
      openPaletteCommands: state.openPaletteCommands,
      setShortcutsVisible: state.setShortcutsVisible,
      goToLineOpen: state.goToLineOpen,
      setGoToLineOpen: state.setGoToLineOpen,
    },
  };
}
