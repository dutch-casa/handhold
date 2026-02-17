import { TerminalTab } from "@/lab/TerminalTab";
import { TerminalTabs } from "@/lab/TerminalTabs";
import type { LabTerminalSlice } from "@/lab/use-lab";

// Multi-tab terminal container.
// Inactive tabs stay mounted (preserving scrollback).
// Only the active tab is visible.

export function TerminalPanel({ terminal }: { readonly terminal: LabTerminalSlice }) {
  const { tabs, spawn, close, select, rename, getHandle } = terminal;

  return (
    <div className="flex h-full flex-col">
      <TerminalTabs
        tabs={tabs}
        onSelect={select}
        onClose={close}
        onSpawn={spawn}
        onRename={rename}
      />
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
