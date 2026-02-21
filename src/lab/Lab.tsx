import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LabLayout } from "@/lab/LabLayout";
import { ActivityBar } from "@/lab/ActivityBar";
import { SidebarContent } from "@/lab/SidebarContent";
import { EditorArea } from "@/lab/EditorArea";
import { TerminalPanel } from "@/lab/TerminalPanel";
import { BottomPanel } from "@/lab/BottomPanel";
import { DiagnosticsPanel } from "@/lab/DiagnosticsPanel";
import { StatusBar } from "@/lab/StatusBar";
import { CommandPalette } from "@/lab/CommandPalette";
import { ShortcutsOverlay } from "@/lab/hotkeys/ShortcutsOverlay";
import { SaveConfirmDialog } from "@/lab/hotkeys/SaveConfirmDialog";
import { GoToLineDialog } from "@/lab/GoToLineDialog";
import { ProvisioningView } from "@/lab/ProvisioningView";
import { ContainerInstallPrompt } from "@/lab/ContainerInstallPrompt";
import { useLab } from "@/lab/use-lab";
import { useLabHotkeys } from "@/lab/hotkeys/use-lab-hotkeys";
import { useAutoSave } from "@/lab/use-auto-save";
import { useRegisterCommands, type PaletteCommand } from "@/lab/command-registry";
import { useSettingsStore } from "@/lab/settings-store";
import type { ParsedLab } from "@/types/lab";
import type { CourseNav } from "@/course/use-course";

type LabProps = {
  readonly manifest: ParsedLab;
  readonly workspacePath: string;
  readonly nav?: CourseNav | undefined;
};

export function Lab({ manifest, workspacePath, nav }: LabProps) {
  const lab = useLab(manifest, workspacePath);
  useLabHotkeys(lab);
  const queryClient = useQueryClient();
  const sidebarPanel = useSettingsStore((s) => s.sidebarPanel);
  const sidebarCollapsed = useSettingsStore((s) => s.sidebarCollapsed);

  const retryProvision = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["lab-provision", manifest.filesPath, workspacePath],
    });
  }, [queryClient, manifest.filesPath, workspacePath]);

  // Auto-save when enabled
  useAutoSave({
    activePath: lab.editor.activePath,
    isDirty: lab.editor.activePath !== undefined
      && lab.editor.tabs.some((t) => t.active && t.dirty),
    save: lab.editor.save,
  });

  // Register palette commands — any component can do this via useRegisterCommands
  const commands: readonly PaletteCommand[] = useMemo(
    () => [
      { id: "toggle-sidebar", label: "Toggle Sidebar", shortcut: "Mod+B", execute: () => useSettingsStore.getState().toggleSidebar() },
      { id: "new-terminal", label: "New Terminal", shortcut: "Mod+Shift+`", execute: () => { lab.terminal.spawn(); } },
      { id: "run-tests", label: "Run Tests", execute: () => { lab.test.run(); } },
      { id: "shortcuts", label: "Keyboard Shortcuts", shortcut: "Mod+/", execute: () => lab.ui.setShortcutsVisible(true) },
      { id: "close-tab", label: "Close Tab", shortcut: "Mod+W", execute: () => {
        const path = lab.editor.focusedPane === "right" ? lab.editor.rightActivePath : lab.editor.activePath;
        if (path !== undefined) lab.ui.requestClose(path);
      }},
      { id: "save-file", label: "Save File", shortcut: "Mod+S", execute: () => { if (lab.editor.activePath !== undefined) lab.editor.save(); } },
      { id: "exec-service", label: "Exec into Service", execute: () => { if (lab.services.selected !== undefined) lab.services.onExec(lab.services.selected); } },
      { id: "show-services", label: "Show Services", execute: () => useSettingsStore.getState().setSidebarPanel("services") },
      { id: "go-to-line", label: "Go to Line...", shortcut: "Mod+G", execute: () => lab.ui.setGoToLineOpen(true) },
      { id: "toggle-word-wrap", label: "Toggle Word Wrap", execute: () => {
        const s = useSettingsStore.getState();
        s.setEditor({ ...s.editor, wordWrap: !s.editor.wordWrap });
      }},
      { id: "toggle-auto-save", label: "Toggle Auto Save", execute: () => {
        const s = useSettingsStore.getState();
        s.setEditor({ ...s.editor, autoSave: !s.editor.autoSave });
      }},
      { id: "focus-explorer", label: "Focus Explorer", execute: () => useSettingsStore.getState().setSidebarPanel("explorer") },
      { id: "focus-instructions", label: "Focus Instructions", execute: () => useSettingsStore.getState().setSidebarPanel("instructions") },
      { id: "focus-search", label: "Focus Search", execute: () => useSettingsStore.getState().setSidebarPanel("search") },
      { id: "focus-services", label: "Focus Services", execute: () => useSettingsStore.getState().setSidebarPanel("services") },
      { id: "focus-testing", label: "Focus Testing", execute: () => useSettingsStore.getState().setSidebarPanel("testing") },
      { id: "focus-settings", label: "Focus Settings", execute: () => useSettingsStore.getState().setSidebarPanel("settings") },
      ...(lab.solution.available ? [{ id: "focus-solution", label: "Focus Solution", execute: () => useSettingsStore.getState().setSidebarPanel("solution") }] : []),
      { id: "toggle-minimap", label: "Toggle Minimap", execute: () => {
        const s = useSettingsStore.getState();
        s.setEditor({ ...s.editor, minimap: !s.editor.minimap });
      }},
      { id: "toggle-sticky-scroll", label: "Toggle Sticky Scroll", execute: () => {
        const s = useSettingsStore.getState();
        s.setEditor({ ...s.editor, stickyScroll: !s.editor.stickyScroll });
      }},
      { id: "close-all-tabs", label: "Close All Tabs", execute: () => lab.editor.closeAll() },
      { id: "close-saved-tabs", label: "Close Saved Tabs", execute: () => lab.editor.closeSaved() },
      { id: "split-right", label: "Split Editor Right", shortcut: "Mod+\\", execute: () => {
        if (lab.editor.activePath !== undefined) lab.editor.splitRight(lab.editor.activePath);
      }},
      { id: "close-split", label: "Close Split Editor", execute: () => lab.editor.closeSplit() },
      { id: "focus-left-pane", label: "Focus Left Editor", shortcut: "Mod+1", execute: () => lab.editor.setFocusedPane("left") },
      { id: "focus-right-pane", label: "Focus Right Editor", shortcut: "Mod+2", execute: () => {
        if (lab.editor.rightActivePath !== undefined) lab.editor.setFocusedPane("right");
      }},
    ],
    [lab.terminal, lab.ui, lab.editor, lab.test, lab.services],
  );
  useRegisterCommands(commands);

  const lifecycle = lab.status.lifecycle;

  if (lifecycle.kind === "missing_runtime") {
    return <ContainerInstallPrompt lab={lifecycle.lab} onRuntimeFound={retryProvision} />;
  }

  if (lifecycle.kind === "provisioning" || lifecycle.kind === "failed") {
    return <ProvisioningView state={lifecycle} />;
  }

  if (lifecycle.kind !== "ready") {
    return null;
  }

  return (
    <>
      <LabLayout
        activityBar={<ActivityBar solutionAvailable={lab.solution.available} />}
        sidebarCollapsed={sidebarCollapsed}
        sidebar={
          <SidebarContent
            activePanel={sidebarPanel}
            files={lab.files}
            test={lab.test}
            services={lab.services}
            solution={lab.solution}
            instructions={lab.instructions}
            onFileSelect={lab.editor.open}
            onGoToLine={lab.editor.goToLine}
            onViewSolution={lab.solution.available ? () => useSettingsStore.getState().setSidebarPanel("solution") : undefined}
          />
        }
        editor={<EditorArea editor={lab.editor} requestClose={lab.ui.requestClose} tree={lab.files.tree} rootPath={lab.files.rootPath} />}
        bottomPanel={
          <BottomPanel
            terminal={<TerminalPanel terminal={lab.terminal} />}
            diagnostics={<DiagnosticsPanel onNavigate={lab.editor.openAt} />}
          />
        }
        statusBar={<StatusBar status={lab.status} nav={nav} activePath={lab.editor.activePath} />}
      />
      <CommandPalette
        open={lab.ui.paletteOpen}
        commandMode={lab.ui.paletteCommandMode}
        onOpenChange={lab.ui.setPaletteOpen}
        files={lab.files.tree}
        onFileSelect={lab.editor.open}
      />
      <ShortcutsOverlay
        visible={lab.ui.shortcutsVisible}
        onClose={() => lab.ui.setShortcutsVisible(false)}
      />
      <SaveConfirmDialog
        closeConfirm={lab.ui.closeConfirm}
        onSave={lab.ui.confirmSaveAndClose}
        onDontSave={lab.ui.confirmClose}
        onCancel={lab.ui.cancelClose}
      />
      <GoToLineDialog
        open={lab.ui.goToLineOpen}
        onClose={() => lab.ui.setGoToLineOpen(false)}
        onGoToLine={lab.editor.goToLine}
      />
    </>
  );
}
