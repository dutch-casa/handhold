import { useEffect, useMemo } from "react";
import { create } from "zustand";

// Command registry — any module can register palette commands.
// Zustand store so the palette subscribes reactively.
// useRegisterCommands handles mount/unmount cleanup.

export type PaletteCommand = {
  readonly id: string;
  readonly label: string;
  readonly category?: string;
  readonly shortcut?: string;
  readonly execute: () => void;
};

type CommandRegistryState = {
  readonly commands: ReadonlyMap<string, PaletteCommand>;
  readonly register: (commands: readonly PaletteCommand[]) => void;
  readonly unregister: (ids: readonly string[]) => void;
};

export const useCommandRegistry = create<CommandRegistryState>((set, get) => ({
  commands: new Map(),

  register: (commands) => {
    const next = new Map(get().commands);
    for (const cmd of commands) next.set(cmd.id, cmd);
    set({ commands: next });
  },

  unregister: (ids) => {
    const next = new Map(get().commands);
    for (const id of ids) next.delete(id);
    set({ commands: next });
  },
}));

// Mount-safe: registers on mount, unregisters on unmount.
// Pass a stable (useMemo'd) array to avoid re-registration churn.
export function useRegisterCommands(commands: readonly PaletteCommand[]): void {
  const ids = useMemo(() => commands.map((c) => c.id), [commands]);

  useEffect(() => {
    useCommandRegistry.getState().register(commands);
    return () => useCommandRegistry.getState().unregister(ids);
  }, [commands, ids]);
}
