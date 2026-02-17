import { useCallback, useRef, useEffect } from "react";
import type { TerminalHandle, SpawnOpts } from "@/lab/tauri/terminal";
import { spawn } from "@/lab/tauri/terminal";

// Multi-tab terminal session manager.
// Owns the TerminalHandle instances (PTY connections).
// Store tracks tab metadata; this hook manages the live handles.

type UseTerminalsOpts = {
  workspacePath: string;
  addTab: (tab: { id: string; title: string }) => void;
  removeTab: (id: string) => void;
  setActive: (id: string) => void;
};

export type TerminalHandleMap = Map<string, TerminalHandle>;

export function useTerminals({
  workspacePath,
  addTab,
  removeTab,
  setActive,
}: UseTerminalsOpts) {
  const handles = useRef<TerminalHandleMap>(new Map());
  let counter = useRef(0);

  const spawnTerminal = useCallback(async (opts?: SpawnOpts) => {
    const handle = await spawn(workspacePath, opts);
    const n = ++counter.current;
    const title = `Terminal ${n}`;

    handles.current.set(handle.sessionId, handle);
    addTab({ id: handle.sessionId, title });
    setActive(handle.sessionId);

    handle.onExit(() => {
      handles.current.delete(handle.sessionId);
      removeTab(handle.sessionId);
    });

    return handle;
  }, [workspacePath, addTab, removeTab, setActive]);

  const closeTerminal = useCallback(
    async (id: string) => {
      const handle = handles.current.get(id);
      if (!handle) return;
      await handle.kill();
      handles.current.delete(id);
      removeTab(id);
    },
    [removeTab],
  );

  const getHandle = useCallback((id: string) => {
    return handles.current.get(id);
  }, []);

  // Kill all sessions on unmount
  useEffect(() => {
    return () => {
      for (const handle of handles.current.values()) {
        handle.kill().catch(() => {});
      }
      handles.current.clear();
    };
  }, []);

  return { spawnTerminal, closeTerminal, getHandle, handles: handles.current };
}
