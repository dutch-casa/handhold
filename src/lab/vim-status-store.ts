import { create } from "zustand";

type VimStatusState = {
  readonly mode: string;
  setMode: (mode: string) => void;
  clear: () => void;
};

export const useVimStatusStore = create<VimStatusState>((set) => ({
  mode: "",
  setMode: (mode) => set({ mode }),
  clear: () => set({ mode: "" }),
}));
