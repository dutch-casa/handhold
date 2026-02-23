// LabWorkshop — full-screen lab authoring environment.
// Reuses the lab's file editing infrastructure (Monaco, file tree, file ops)
// without runtime concerns (containers, terminals, lifecycle, tests).
// Left: file explorer. Center: Monaco editor. Right: lab definition editors.

import { useState, useCallback, useMemo, useRef } from "react";
import type { editor as monacoEditor } from "monaco-editor";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";

// Lab infrastructure — sub-hooks and components
import { createLabStore, type CloseConfirmState } from "@/lab/store";
import { useFileTree } from "@/lab/use-file-tree";
import { useFile } from "@/lab/use-file";
import { useFileOps } from "@/lab/use-file-ops";
import { useGitDiff } from "@/lab/use-git-diff";
import { useMonacoModels } from "@/lab/use-monaco-models";
import { useAutoSave } from "@/lab/use-auto-save";
import { useSettingsStore } from "@/lab/settings-store";
import { getFileIcon } from "@/lab/file-icons";
import { EditorArea } from "@/lab/EditorArea";
import { ExplorerPanel } from "@/lab/ExplorerPanel";
import { SaveConfirmDialog } from "@/lab/hotkeys/SaveConfirmDialog";
import type { LabEditorSlice, LabFilesSlice, EditorTabView } from "@/lab/use-lab";
import type { ParsedLab } from "@/types/lab";

// Course editor integration
import { useCourseEditorStore } from "@/editor/viewmodel/course-editor-store";
import type { EditableLab, EditableCourseStep } from "@/editor/model/types";

// Lab definition editors (authoring-specific right panel)
import { LabInstructionsEditor } from "@/editor/view/lab/LabInstructionsEditor";
import { LabConfigEditor } from "@/editor/view/lab/LabConfigEditor";
import { LabServicePicker } from "@/editor/view/lab/LabServicePicker";
import { useLabEditor } from "@/editor/viewmodel/lab-editor-store";
import { Agent } from "@/editor/view/panel/Agent";

// ── Pure helpers ─────────────────────────────────────────────────

function findLabForStep(stepId: string): EditableLab | undefined {
  const course = useCourseEditorStore.getState().course;
  if (!course) return undefined;
  const step = course.steps.find((s) => s.id === stepId);
  if (!step || step.kind !== "lab") return undefined;
  return step.lab;
}

// ── Path helpers (same as use-lab.ts) ────────────────────────────

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
  rootPath: string,
): readonly string[] {
  if (activePath === undefined) return [];
  const relative = activePath.startsWith(rootPath)
    ? activePath.slice(rootPath.length + 1)
    : activePath;
  return relative.split("/").filter(Boolean);
}

// ── Resolve lab from step ID ─────────────────────────────────────

function useLabStep(stepId: string): { lab: EditableLab; title: string } | undefined {
  return useCourseEditorStore(
    useShallow((s) => {
      if (!s.course) return undefined;
      const step = s.course.steps.find(
        (cs): cs is EditableCourseStep & { readonly kind: "lab" } =>
          cs.kind === "lab" && cs.id === stepId,
      );
      if (!step) return undefined;
      return { lab: step.lab, title: step.title };
    }),
  );
}

// ── Workshop editor hook ─────────────────────────────────────────
// Wires the same sub-hooks as useLab but only the file-editing ones.
// No lifecycle, containers, terminals, or tests.

type WorkshopEditor = {
  readonly files: LabFilesSlice;
  readonly editor: LabEditorSlice;
  readonly closeConfirm: CloseConfirmState;
  readonly requestClose: (path: string) => void;
  readonly confirmSaveAndClose: () => Promise<void>;
  readonly confirmClose: () => void;
  readonly cancelClose: () => void;
};

function useWorkshopEditor(labDirPath: string): WorkshopEditor {
  // The scaffold source files live at labDirPath/scaffold.
  // That's what the author edits — the starting code for learners.
  const scaffoldPath = `${labDirPath}/scaffold`;

  // Minimal manifest — createLabStore ignores parsed lab content,
  // only uses it to seed initial state (which is empty anyway).
  const manifest = useMemo<ParsedLab>(() => ({
    title: "",
    instructions: "",
    filesPath: labDirPath,
    solutionPath: undefined,
    workspace: "continue",
    testCommand: "",
    openFiles: [],
    services: [],
    setup: [],
    start: [],
  }), [labDirPath]);

  const store = useMemo(() => createLabStore(manifest), [manifest]);
  const state = useStore(store);

  // --- File infrastructure ---
  const { tree, loading: treeLoading, refresh: refreshTree } = useFileTree(scaffoldPath);
  const fileOps = useFileOps(scaffoldPath);

  // --- File content (one query per pane) ---
  const { content, save: saveFileLeft, loading: contentLoading } = useFile(state.activePath);
  const { content: rightContent, save: saveFileRight, loading: rightContentLoading } = useFile(state.rightActivePath);

  // --- Mutable refs for live content + Monaco instances ---
  const liveContentMap = useRef(new Map<string, string>());
  const editorInstanceMap = useRef(new Map<string, monacoEditor.IStandaloneCodeEditor>());

  const setEditorInstance = useCallback((path: string, ed: monacoEditor.IStandaloneCodeEditor | null) => {
    if (ed) editorInstanceMap.current.set(path, ed);
    else editorInstanceMap.current.delete(path);
  }, []);

  // --- Navigation ---
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

  // --- Cross-file IntelliSense + git markers ---
  useMonacoModels(scaffoldPath);
  const gitChanges = useGitDiff(state.activePath, scaffoldPath);
  const rightGitChanges = useGitDiff(state.rightActivePath, scaffoldPath);

  // --- Editor settings from persisted store ---
  const { vimMode, fontSize, tabSize } = useSettingsStore((s) => s.editor);

  // --- Derived view data ---
  const editorTabs: readonly EditorTabView[] = useMemo(() => {
    const { openPaths, activePath, rightActivePath, dirtyPaths, solutionOpenPaths } = state;
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
        solution: solutionOpenPaths.has(path),
      };
    });
  }, [state.openPaths, state.activePath, state.rightActivePath, state.dirtyPaths, state.solutionOpenPaths]);

  const breadcrumbs = useMemo(
    () => breadcrumbsFromPath(state.activePath, scaffoldPath),
    [state.activePath, scaffoldPath],
  );

  const rightBreadcrumbs = useMemo(
    () => breadcrumbsFromPath(state.rightActivePath, scaffoldPath),
    [state.rightActivePath, scaffoldPath],
  );

  // --- Save logic ---
  const saveToDisk = useCallback(
    async (path: string, text: string) => {
      if (path === state.activePath) await saveFileLeft(text);
      else if (path === state.rightActivePath) await saveFileRight(text);
    },
    [state.activePath, state.rightActivePath, saveFileLeft, saveFileRight],
  );

  const saveContent = useCallback(
    async (path: string, text: string) => {
      await saveToDisk(path, text);
      liveContentMap.current.set(path, text);
      state.markClean(path);
    },
    [saveToDisk, state.markClean],
  );

  const save = useCallback(async () => {
    const path = focusedPath;
    if (!path) return;
    const cached = path === state.activePath ? content : rightContent;
    const toSave = liveContentMap.current.get(path) ?? cached;
    if (toSave === undefined) return;
    await saveContent(path, toSave);
  }, [focusedPath, state.activePath, content, rightContent, saveContent]);

  const markDirty = useCallback((path: string, liveContent: string) => {
    liveContentMap.current.set(path, liveContent);
    state.markDirty(path);
  }, [state.markDirty]);

  // --- Auto-save ---
  useAutoSave({
    activePath: state.activePath,
    isDirty: state.activePath !== undefined && state.dirtyPaths.has(state.activePath),
    save,
  });

  // --- Close confirmation ---
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
  }, [state, content, rightContent, saveToDisk]);

  // --- Assembled slices ---
  const files: LabFilesSlice = useMemo(() => ({
    tree,
    loading: treeLoading,
    rootPath: scaffoldPath,
    select: state.openFile,
    ops: fileOps,
    refresh: refreshTree,
  }), [tree, treeLoading, scaffoldPath, state.openFile, fileOps, refreshTree]);

  const editor: LabEditorSlice = useMemo(() => ({
    tabs: editorTabs,
    activePath: state.activePath,
    content,
    contentLoading,
    breadcrumbs,
    gitChanges,
    solutionOpenPaths: state.solutionOpenPaths,
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
  }), [
    editorTabs, state, content, contentLoading, breadcrumbs, gitChanges,
    rightContent, rightContentLoading, rightBreadcrumbs, rightGitChanges,
    fontSize, tabSize, vimMode, save, saveContent, markDirty,
    goToLine, openAt, setEditorInstance,
  ]);

  return {
    files,
    editor,
    closeConfirm: state.closeConfirm,
    requestClose: state.promptClose,
    confirmSaveAndClose,
    confirmClose: state.confirmClose,
    cancelClose: state.cancelClose,
  };
}

// ── Right panel tabs ──────────────────────────────────────────────

type RightPanelTab = "agent" | "instructions" | "tests" | "config" | "services";

const RIGHT_TABS: readonly { readonly id: RightPanelTab; readonly label: string; readonly icon: string }[] = [
  { id: "agent", label: "AI", icon: "M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6H8.3C6.3 13.7 5 11.5 5 9a7 7 0 0 1 7-7zM9 22h6M10 18h4" },
  { id: "instructions", label: "Docs", icon: "M4 4h16v16H4zM8 8h8M8 12h6" },
  { id: "tests", label: "Tests", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" },
  { id: "config", label: "Config", icon: "M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2zM12 15a3 3 0 100-6 3 3 0 000 6z" },
  { id: "services", label: "Services", icon: "M2 20h20M6 16v4M10 12v8M14 8v12M18 4v16" },
];

function RightPanelContent({ tab, stepId }: { readonly tab: RightPanelTab; readonly stepId: string }) {
  switch (tab) {
    case "agent":
      return <Agent />;
    case "instructions":
      return <LabInstructionsEditor stepId={stepId} />;
    case "tests":
      return <LabTestsPanel stepId={stepId} />;
    case "config":
      return <LabConfigEditor stepId={stepId} />;
    case "services":
      return <LabServicePicker stepId={stepId} />;
  }
}

// ── Tests panel ──────────────────────────────────────────────────

function LabTestsPanel({ stepId }: { readonly stepId: string }) {
  const lab = findLabForStep(stepId);
  if (!lab) {
    return (
      <div className="ide-empty-state h-full">
        <span className="text-ide-sm text-muted-foreground">Lab not found</span>
      </div>
    );
  }
  return <LabTestsPanelInner lab={lab} />;
}

function LabTestsPanelInner({ lab }: { readonly lab: EditableLab }) {
  const store = useLabEditor(lab);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-sp-4 p-sp-4">
        <div className="flex flex-col gap-sp-2">
          <label className="text-ide-xs font-semibold text-foreground" htmlFor="test-command">
            Test Command
          </label>
          <input
            id="test-command"
            type="text"
            className="focus-ring min-h-[44px] rounded-md border border-border bg-secondary px-sp-3 py-sp-2 font-mono text-ide-xs text-foreground placeholder:text-muted-foreground/50"
            placeholder="e.g. bun test, npm test, pytest"
            value={store.lab.testCommand}
            onChange={(e) => { store.updateTestCommand(e.target.value); }}
          />
          <p className="text-ide-2xs text-muted-foreground">
            Command run to verify the learner's solution.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="flex min-h-[44px] items-center justify-center gap-sp-2 rounded-md border border-border bg-secondary
            px-sp-4 py-sp-2 text-ide-xs font-medium text-muted-foreground
            disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Run tests"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Run Tests
        </button>
      </div>

      <div className="flex-1 min-h-0 border-t border-border">
        <div className="ide-empty-state h-full">
          <span className="text-ide-2xs text-muted-foreground/60">
            Test output will appear here
          </span>
        </div>
      </div>
    </div>
  );
}

// ── LabWorkshop ───────────────────────────────────────────────────

type LabWorkshopProps = {
  readonly stepId: string;
};

export function LabWorkshop({ stepId }: LabWorkshopProps) {
  const resolved = useLabStep(stepId);
  const closeLabWorkshop = () => {};
  const [rightTab, setRightTab] = useState<RightPanelTab>("agent");

  if (!resolved) {
    return (
      <div className="flex h-screen flex-col">
        <LabWorkshopHeader title="Lab not found" onBack={closeLabWorkshop} />
        <div className="flex flex-1 items-center justify-center">
          <span className="text-ide-sm text-muted-foreground">
            Lab step not found: {stepId}
          </span>
        </div>
      </div>
    );
  }

  return (
    <LabWorkshopInner
      stepId={stepId}
      title={resolved.title}
      scaffoldPath={resolved.lab.scaffoldPath}
      rightTab={rightTab}
      setRightTab={setRightTab}
      onBack={closeLabWorkshop}
    />
  );
}

// Inner component — only renders when lab is resolved.
// Hooks (useWorkshopEditor) can't be called conditionally,
// so this component boundary handles the early return above.

type LabWorkshopInnerProps = {
  readonly stepId: string;
  readonly title: string;
  readonly scaffoldPath: string;
  readonly rightTab: RightPanelTab;
  readonly setRightTab: (tab: RightPanelTab) => void;
  readonly onBack: () => void;
};

function LabWorkshopInner({
  stepId,
  title,
  scaffoldPath,
  rightTab,
  setRightTab,
  onBack,
}: LabWorkshopInnerProps) {
  const workshop = useWorkshopEditor(scaffoldPath);

  return (
    <div className="flex h-screen flex-col bg-background">
      <LabWorkshopHeader title={title} onBack={onBack} />

      <div className="flex flex-1 min-h-0">
        {/* Left: File explorer */}
        <div className="flex w-[240px] shrink-0 flex-col border-r border-border">
          <ExplorerPanel files={workshop.files} />
        </div>

        {/* Center: Monaco editor */}
        <div className="flex flex-1 min-w-0 flex-col">
          <EditorArea
            editor={workshop.editor}
            requestClose={workshop.requestClose}
            tree={workshop.files.tree}
            rootPath={workshop.files.rootPath}
          />
        </div>

        {/* Right: Lab definition editors */}
        <div className="flex w-[400px] shrink-0 flex-col border-l border-border bg-card">
          <div className="flex h-10 shrink-0 items-center gap-px border-b border-border bg-background px-sp-1">
            {RIGHT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRightTab(t.id)}
                aria-label={t.label}
                aria-pressed={rightTab === t.id}
                className={`flex items-center gap-sp-1 rounded-md px-sp-2 py-sp-1 text-ide-2xs font-medium
                  transition-colors duration-fast min-h-[28px]
                  ${rightTab === t.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={t.icon} />
                </svg>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <RightPanelContent tab={rightTab} stepId={stepId} />
          </div>
        </div>
      </div>

      <SaveConfirmDialog
        closeConfirm={workshop.closeConfirm}
        onSave={workshop.confirmSaveAndClose}
        onDontSave={workshop.confirmClose}
        onCancel={workshop.cancelClose}
      />
    </div>
  );
}

// ── Header bar ───────────────────────────────────────────────────

function LabWorkshopHeader({
  title,
  onBack,
}: {
  readonly title: string;
  readonly onBack: () => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-sp-3 border-b border-border px-sp-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to course editor"
        className="flex items-center gap-sp-2 rounded-md px-sp-3 py-sp-1 text-ide-xs text-muted-foreground
          transition-colors duration-fast hover:bg-accent hover:text-foreground min-h-[36px]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Course
      </button>
      <div className="h-5 w-px bg-border" />
      <span className="text-ide-sm font-semibold text-foreground">{title}</span>
      <span className="rounded-full bg-primary/15 px-sp-2 py-0.5 text-ide-2xs font-medium text-primary">
        Lab
      </span>
    </div>
  );
}
