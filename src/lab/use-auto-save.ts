import { useEffect, useRef } from "react";
import { useSettingsStore } from "@/lab/settings-store";

// Auto-saves dirty files after a debounce delay.
// Watches the active file's dirty state and triggers save when stable.

type AutoSaveOpts = {
  readonly activePath: string | undefined;
  readonly isDirty: boolean;
  readonly save: () => Promise<void>;
};

export function useAutoSave({ activePath, isDirty, save }: AutoSaveOpts): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const { autoSave, autoSaveDelay } = useSettingsStore.getState().editor;
    if (!autoSave || !isDirty || activePath === undefined) return;

    timerRef.current = setTimeout(() => {
      save();
    }, autoSaveDelay);

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [activePath, isDirty, save]);
}
