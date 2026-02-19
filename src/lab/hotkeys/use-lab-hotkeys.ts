import { useHotkey } from "@tanstack/react-hotkeys";
import { useSettingsStore } from "@/lab/settings-store";
import type { Lab } from "@/lab/use-lab";

// Deep module: registers all Lab keyboard shortcuts.
// Called once in Lab.tsx. Returns void — pure side-effect registration.
// Reads Lab actions directly; dispatches to stores.
//
// Vim coexistence: all bindings use modifier keys (Mod+X), which
// TanStack's smart ignoreInputs lets through even in text inputs.
// CodeMirror's vim mode captures its own keys (g, d, etc.) internally
// — no conflict because we never bind single unmodified keys.

export function useLabHotkeys(lab: Lab): void {
  const { editor, terminal, ui } = lab;

  // --- File ---

  useHotkey("Mod+S", () => {
    if (editor.activePath === undefined) return;
    editor.save();
  }, { preventDefault: true, conflictBehavior: "replace" });

  useHotkey("Mod+W", () => {
    const path = editor.focusedPane === "right" ? editor.rightActivePath : editor.activePath;
    if (path === undefined) return;
    ui.requestClose(path);
  }, { preventDefault: true });

  // --- View ---

  useHotkey("Mod+P", () => {
    ui.setPaletteOpen(!ui.paletteOpen);
  }, { preventDefault: true });

  useHotkey("Mod+Shift+P", () => {
    ui.openPaletteCommands();
  }, { preventDefault: true });

  useHotkey("Mod+B", () => {
    useSettingsStore.getState().toggleSidebar();
  }, { preventDefault: true });

  useHotkey("Mod+/", () => {
    ui.setShortcutsVisible(!ui.shortcutsVisible);
  }, { preventDefault: true });

  // Escape: priority chain — palette → goToLine → shortcuts → nothing
  useHotkey("Escape", () => {
    if (ui.paletteOpen) {
      ui.setPaletteOpen(false);
      return;
    }
    if (ui.goToLineOpen) {
      ui.setGoToLineOpen(false);
      return;
    }
    if (ui.shortcutsVisible) {
      ui.setShortcutsVisible(false);
      return;
    }
  }, { requireReset: true });

  // --- Navigation ---

  useHotkey("Mod+G", () => {
    ui.setGoToLineOpen(true);
  }, { preventDefault: true });

  // --- Terminal ---

  // RawHotkey for Shift+punctuation (layout-dependent keys excluded from string types)
  useHotkey({ key: "`", mod: true, shift: true }, () => {
    terminal.spawn();
  }, { preventDefault: true });

  // --- Navigation ---

  useHotkey({ key: "]", mod: true, shift: true }, () => {
    const tabs = editor.tabs;
    const idx = tabs.findIndex((t) => t.active);
    if (idx === -1 || tabs.length < 2) return;
    const next = tabs[(idx + 1) % tabs.length];
    if (next) editor.select(next.path);
  }, { preventDefault: true });

  useHotkey({ key: "[", mod: true, shift: true }, () => {
    const tabs = editor.tabs;
    const idx = tabs.findIndex((t) => t.active);
    if (idx === -1 || tabs.length < 2) return;
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    if (prev) editor.select(prev.path);
  }, { preventDefault: true });

  // --- Split Editor ---

  useHotkey({ key: "\\", mod: true }, () => {
    if (editor.activePath !== undefined) {
      editor.splitRight(editor.activePath);
    }
  }, { preventDefault: true });

  useHotkey("Mod+1", () => {
    editor.setFocusedPane("left");
  }, { preventDefault: true });

  useHotkey("Mod+2", () => {
    if (editor.rightActivePath !== undefined) {
      editor.setFocusedPane("right");
    }
  }, { preventDefault: true });
}
