import { useCallback, useMemo, useRef } from "react";
import type { editor as monacoEditor } from "monaco-editor";
import { useStore } from "zustand";
import { createLabStore, type CloseConfirmState } from "@/lab/store";
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
};

export type LabEditorSlice = {
  readonly tabs: readonly EditorTabView[];
  readonly activePath: string | undefined;
  readonly content: string | undefined;
  readonly contentLoading: boolean;
  readonly breadcrumbs: readonly string[];
  readonly gitChanges: readonly LineChange[];
  readonly fontSize: number;
  readonly tabSize: number;
  readonly vimMode: boolean;
  readonly open: (path: string) => void;
  readonly close: (path: string) => void;
  readonly select: (path: string) => void;
  readonly save: () => Promise<void>;
  readonly saveContent: (content: string) => Promise<void>;
  readonly markDirty: (content: string) => void;
  readonly closeOthers: (path: string) => void;
  readonly closeAll: () => void;
  readonly closeSaved: () => void;
  readonly goToLine: (line: number) => void;
  readonly openAt: (path: string, line: number, column: number) => void;
  readonly setEditorInstance: (editor: monacoEditor.IStandaloneCodeEditor | null) => void;
};

export type LabTerminalSlice = {
  readonly tabs: readonly TerminalTabView[];
  readonly spawn: (opts?: SpawnOpts) => Promise<TerminalHandle>;
  readonly close: (id: string) => Promise<void>;
  readonly select: (id: string) => void;
  readonly rename: (id: string, title: string) => void;
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
  const { tree, loading: treeLoading } = useFileTree(workspacePath);

  // File CRUD with automatic cache invalidation
  const fileOps = useFileOps(workspacePath);

  // Active file content via React Query
  const { content, save: saveFile, loading: contentLoading } = useFile(
    state.activePath,
  );

  // Live editor content — updated on every CodeMirror doc change.
  // Reads from here are always current; React Query cache may lag.
  const liveContentRef = useRef<string | undefined>(undefined);

  // Monaco editor ref for imperative operations (goToLine, search navigation)
  const editorInstanceRef = useRef<monacoEditor.IStandaloneCodeEditor | null>(null);

  const setEditorInstance = useCallback((ed: monacoEditor.IStandaloneCodeEditor | null) => {
    editorInstanceRef.current = ed;
  }, []);

  const goToLine = useCallback((line: number) => {
    const ed = editorInstanceRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model) return;
    const clamped = Math.max(1, Math.min(line, model.getLineCount()));
    ed.setPosition({ lineNumber: clamped, column: 1 });
    ed.revealLineInCenter(clamped);
    ed.focus();
  }, []);

  // Navigate to a specific file + line + column (used by go-to-definition and diagnostics)
  const openAt = useCallback((path: string, line: number, column: number) => {
    state.openFile(path);
    // Editor remounts on path change (key={activePath}), so defer cursor positioning
    requestAnimationFrame(() => {
      const ed = editorInstanceRef.current;
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

  // Git gutter markers for active file
  const gitChanges = useGitDiff(state.activePath);

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
    const { openPaths, activePath, dirtyPaths } = state;
    return openPaths.map((path) => {
      const name = nameFromPath(path);
      const ext = extFromName(name);
      const { icon, color } = getFileIcon(name, ext);
      return {
        path,
        name,
        ext,
        icon,
        iconColor: color,
        dirty: dirtyPaths.has(path),
        active: path === activePath,
      };
    });
  }, [state.openPaths, state.activePath, state.dirtyPaths]);

  const breadcrumbs = useMemo(
    () => breadcrumbsFromPath(state.activePath, workspacePath),
    [state.activePath, workspacePath],
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

  // Writes the given content to disk and clears dirty state.
  const saveContent = useCallback(
    async (text: string) => {
      if (state.activePath === undefined) return;
      await saveFile(text);
      liveContentRef.current = text;
      state.markClean(state.activePath);
    },
    [state.activePath, saveFile, state.markClean],
  );

  // Saves the live CodeMirror content (for external callers that don't have the text).
  const save = useCallback(
    async () => {
      const toSave = liveContentRef.current ?? content;
      if (toSave === undefined) return;
      await saveContent(toSave);
    },
    [content, saveContent],
  );

  // Captures live CodeMirror content and marks the file dirty.
  const markDirty = useCallback((liveContent: string) => {
    liveContentRef.current = liveContent;
    if (state.activePath !== undefined) state.markDirty(state.activePath);
  }, [state.activePath, state.markDirty]);

  // Composed: save the file being prompted about, then close it.
  // Uses liveContentRef to get current editor content (not stale cache).
  const confirmSaveAndClose = useCallback(async () => {
    const { closeConfirm } = state;
    if (closeConfirm.kind !== "prompting") return;
    const toSave = liveContentRef.current ?? content;
    if (toSave !== undefined) {
      await saveFile(toSave);
      state.markClean(closeConfirm.path);
    }
    state.closeFile(closeConfirm.path);
    state.cancelClose();
  }, [state.closeConfirm, content, saveFile, state.markClean, state.closeFile, state.cancelClose]);

  return {
    files: {
      tree,
      loading: treeLoading,
      rootPath: workspacePath,
      select: state.openFile,
      ops: fileOps,
    },
    editor: {
      tabs: editorTabs,
      activePath: state.activePath,
      content,
      contentLoading,
      breadcrumbs,
      gitChanges,
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
      goToLine,
      openAt,
      setEditorInstance,
    },
    terminal: {
      tabs: terminalTabs,
      spawn: terminals.spawnTerminal,
      close: terminals.closeTerminal,
      select: state.setActiveTerminal,
      rename: state.renameTerminal,
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
