import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { TerminalTab } from "@/lab/TerminalTab";
import { TerminalTabs } from "@/lab/TerminalTabs";
import type { LabTerminalSlice } from "@/lab/use-lab";

// Multi-tab terminal container.
// Inactive tabs stay mounted (preserving scrollback).
// Only the active tab is visible.

const isWindows = navigator.userAgent.includes("Windows");

// Warns when Git Bash is absent on Windows — the terminal depends on it.
function GitBashWarning() {
  const { data: hasGitBash } = useQuery({
    queryKey: ["check_git_bash"],
    queryFn: () => invoke<boolean>("check_git_bash"),
    // Static capability check — never stale, skip entirely on non-Windows.
    staleTime: Infinity,
    enabled: isWindows,
  });

  if (!isWindows || hasGitBash !== false) return null;

  return (
    <div className="flex items-center gap-2 border-b border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
      <span>Git Bash not found. The terminal requires Git for Windows.</span>
      <a
        href="https://git-scm.com/download/win"
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-yellow-100"
      >
        Download
      </a>
    </div>
  );
}

export function TerminalPanel({ terminal }: { readonly terminal: LabTerminalSlice }) {
  const { tabs, spawn, close, select, rename, reorderTerminals, getHandle } = terminal;

  return (
    <div className="flex h-full flex-col">
      <TerminalTabs
        tabs={tabs}
        onSelect={select}
        onClose={close}
        onSpawn={spawn}
        onRename={rename}
        onReorder={reorderTerminals}
      />
      <GitBashWarning />
      <div className="relative flex-1 overflow-hidden">
        {tabs.map((tab) => {
          const handle = getHandle(tab.id);
          if (!handle) return null;
          return (
            <TerminalTab
              key={tab.id}
              handle={handle}
              visible={tab.active}
            />
          );
        })}
        {tabs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            <button
              onClick={() => { spawn(); }}
              className="press focus-ring rounded-md border border-border px-4 py-2 transition-colors hover:bg-muted"
            >
              Open a terminal
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
