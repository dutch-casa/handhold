import { create } from "zustand";

// Dedicated store for cursor position — separate from lab store to avoid
// re-rendering the entire lab tree on every keystroke.
// Single writer: EditorView update listener in Editor.tsx.

type CursorState = {
  readonly line: number;
  readonly col: number;
  readonly setCursor: (line: number, col: number) => void;
  readonly clear: () => void;
};

export const useEditorCursorStore = create<CursorState>((set) => ({
  line: 1,
  col: 1,
  setCursor: (line, col) => set({ line, col }),
  clear: () => set({ line: 1, col: 1 }),
}));
