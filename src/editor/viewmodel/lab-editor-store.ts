// Lab editor store. Manages a single lab's instructions, config, scaffold,
// and service definitions. Factory-scoped: one store instance per EditableLab.
// Pattern: State (readonly) + Actions (named transitions). Views select, never set.

import { useRef } from "react";
import { create, type StoreApi, useStore } from "zustand";
import type { EditableLab, EditableService } from "@/editor/model/types";

// --- State + Actions ---

type LabEditorState = {
  readonly lab: EditableLab;
};

type LabEditorActions = {
  updateTitle(title: string): void;
  updateInstructions(text: string): void;
  updateTestCommand(cmd: string): void;
  updateWorkspace(mode: "fresh" | "continue"): void;
  addService(service: EditableService): void;
  removeService(name: string): void;
  updateService(name: string, patch: Partial<EditableService>): void;
  addSetupCommand(cmd: string): void;
  removeSetupCommand(index: number): void;
  reorderSetupCommand(fromIndex: number, toIndex: number): void;
  addStartCommand(cmd: string): void;
  removeStartCommand(index: number): void;
  reorderStartCommand(fromIndex: number, toIndex: number): void;
  addOpenFile(path: string): void;
  removeOpenFile(path: string): void;
  updateScaffoldPath(path: string): void;
};

export type LabEditorStore = LabEditorState & LabEditorActions;

// --- Factory ---

export function createLabEditorStore(
  lab: EditableLab,
): StoreApi<LabEditorStore> {
  return create<LabEditorStore>((set) => ({
    lab,

    updateTitle: (title) => {
      set((s) => {
        s.lab.title = title;
        return { lab: { ...s.lab } };
      });
    },

    updateInstructions: (text) => {
      set((s) => {
        s.lab.instructions = text;
        return { lab: { ...s.lab } };
      });
    },

    updateTestCommand: (cmd) => {
      set((s) => {
        s.lab.testCommand = cmd;
        return { lab: { ...s.lab } };
      });
    },

    updateWorkspace: (mode) => {
      set((s) => {
        s.lab.workspace = mode;
        return { lab: { ...s.lab } };
      });
    },

    addService: (service) => {
      set((s) => {
        s.lab.services.push(service);
        return { lab: { ...s.lab } };
      });
    },

    removeService: (name) => {
      set((s) => {
        const idx = s.lab.services.findIndex((svc) => svc.name === name);
        if (idx === -1) return s;
        s.lab.services.splice(idx, 1);
        return { lab: { ...s.lab } };
      });
    },

    updateService: (name, patch) => {
      set((s) => {
        const svc = s.lab.services.find((svc) => svc.name === name);
        if (!svc) return s;
        Object.assign(svc, patch);
        return { lab: { ...s.lab } };
      });
    },

    addSetupCommand: (cmd) => {
      set((s) => {
        s.lab.setup.push(cmd);
        return { lab: { ...s.lab } };
      });
    },

    removeSetupCommand: (index) => {
      set((s) => {
        if (index < 0 || index >= s.lab.setup.length) return s;
        s.lab.setup.splice(index, 1);
        return { lab: { ...s.lab } };
      });
    },

    reorderSetupCommand: (fromIndex, toIndex) => {
      set((s) => {
        const { setup } = s.lab;
        if (fromIndex === toIndex) return s;
        if (fromIndex < 0 || fromIndex >= setup.length) return s;
        if (toIndex < 0 || toIndex >= setup.length) return s;
        const [item] = setup.splice(fromIndex, 1);
        setup.splice(toIndex, 0, item!);
        return { lab: { ...s.lab } };
      });
    },

    addStartCommand: (cmd) => {
      set((s) => {
        s.lab.start.push(cmd);
        return { lab: { ...s.lab } };
      });
    },

    removeStartCommand: (index) => {
      set((s) => {
        if (index < 0 || index >= s.lab.start.length) return s;
        s.lab.start.splice(index, 1);
        return { lab: { ...s.lab } };
      });
    },

    reorderStartCommand: (fromIndex, toIndex) => {
      set((s) => {
        const { start } = s.lab;
        if (fromIndex === toIndex) return s;
        if (fromIndex < 0 || fromIndex >= start.length) return s;
        if (toIndex < 0 || toIndex >= start.length) return s;
        const [item] = start.splice(fromIndex, 1);
        start.splice(toIndex, 0, item!);
        return { lab: { ...s.lab } };
      });
    },

    addOpenFile: (path) => {
      set((s) => {
        if (s.lab.openFiles.includes(path)) return s;
        s.lab.openFiles.push(path);
        return { lab: { ...s.lab } };
      });
    },

    removeOpenFile: (path) => {
      set((s) => {
        const idx = s.lab.openFiles.indexOf(path);
        if (idx === -1) return s;
        s.lab.openFiles.splice(idx, 1);
        return { lab: { ...s.lab } };
      });
    },

    updateScaffoldPath: (path) => {
      set((s) => {
        s.lab.scaffoldPath = path;
        return { lab: { ...s.lab } };
      });
    },
  }));
}

// --- Scoped hook ---

// Creates or retrieves a store bound to the given EditableLab instance.
// Stable across re-renders: the store is created once per hook mount.
export function useLabEditor(lab: EditableLab): LabEditorStore {
  const storeRef = useRef<StoreApi<LabEditorStore>>(undefined);
  if (storeRef.current === undefined) {
    storeRef.current = createLabEditorStore(lab);
  }
  return useStore(storeRef.current);
}
