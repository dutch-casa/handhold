// Global keyboard shortcut handler for the course editor.
// Side-effect-only component — renders nothing, wires a single keydown listener.

import { useEffect } from "react";
import { useCourseEditorStore } from "@/editor/viewmodel/course-editor-store";
import { useLayoutStore } from "@/editor/viewmodel/layout-store";

const AGENT_CHAT_SELECTOR = "[data-agent-chat-input]";

const IS_MAC =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

function isModifier(e: KeyboardEvent): boolean {
  return IS_MAC ? e.metaKey : e.ctrlKey;
}

export function KeyboardShortcuts() {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (!isModifier(e)) return;

      const key = e.key.toLowerCase();

      // Cmd+S — Save
      if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        useCourseEditorStore.getState().save();
        return;
      }

      // Cmd+Shift+Z — Redo (must check before Cmd+Z)
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        useCourseEditorStore.getState().redo();
        return;
      }

      // Cmd+Z — Undo
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        useCourseEditorStore.getState().undo();
        return;
      }

      // Cmd+L — Focus agent chat input
      if (key === "l" && !e.shiftKey) {
        e.preventDefault();
        useLayoutStore.getState().setPanelTab("agent");
        requestAnimationFrame(() => {
          const el = document.querySelector<HTMLTextAreaElement>(AGENT_CHAT_SELECTOR);
          el?.focus();
        });
        return;
      }

      // Cmd+B — Toggle sidebar
      if (key === "b" && !e.shiftKey) {
        e.preventDefault();
        useLayoutStore.getState().toggleSidebar();
        return;
      }

      // Cmd+J — Toggle bottom bar
      if (key === "j" && !e.shiftKey) {
        e.preventDefault();
        useLayoutStore.getState().toggleBottomBar();
        return;
      }

      // Cmd+\ — Toggle right panel
      if (key === "\\" && !e.shiftKey) {
        e.preventDefault();
        useLayoutStore.getState().togglePanel();
        return;
      }

      // Cmd+W — Close active tab
      if (key === "w" && !e.shiftKey) {
        e.preventDefault();
        const { activeTabId, closeTab } = useCourseEditorStore.getState();
        if (activeTabId) {
          closeTab(activeTabId);
        }
        return;
      }
    }

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  return null;
}
