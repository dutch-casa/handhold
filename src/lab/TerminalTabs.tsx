import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";
import type { TerminalTabView } from "@/lab/use-lab";

type TerminalTabsProps = {
  readonly tabs: readonly TerminalTabView[];
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onSpawn: () => void;
  readonly onRename: (id: string, title: string) => void;
};

function InlineRename({
  initial,
  onCommit,
  onCancel,
}: {
  readonly initial: string;
  readonly onCommit: (value: string) => void;
  readonly onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.select();
  }, []);

  const commit = useCallback(() => {
    const value = ref.current?.value.trim();
    if (value && value !== initial) {
      onCommit(value);
    } else {
      onCancel();
    }
  }, [initial, onCommit, onCancel]);

  return (
    <input
      ref={ref}
      defaultValue={initial}
      className="w-20 bg-transparent text-xs outline-none ring-1 ring-ring rounded-sm px-1.5"
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export function TerminalTabs({
  tabs,
  onSelect,
  onClose,
  onSpawn,
  onRename,
}: TerminalTabsProps) {
  const [renamingId, setRenamingId] = useState<string | undefined>(undefined);

  return (
    <div className="ide-tab-bar ide-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          data-active={tab.active}
          onClick={() => onSelect(tab.id)}
          onDoubleClick={() => setRenamingId(tab.id)}
          className="ide-tab focus-ring"
        >
          {renamingId === tab.id ? (
            <InlineRename
              initial={tab.title}
              onCommit={(value) => {
                onRename(tab.id, value);
                setRenamingId(undefined);
              }}
              onCancel={() => setRenamingId(undefined)}
            />
          ) : (
            <span>{tab.title}</span>
          )}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onClose(tab.id);
              }
            }}
            className="ide-tab-close focus-ring"
            aria-label={`Close ${tab.title}`}
          >
            <X className="size-3" />
          </span>
        </button>
      ))}
      <button
        onClick={onSpawn}
        className="focus-ring flex items-center px-2.5 text-muted-foreground transition-colors hover:text-foreground"
        aria-label="New terminal"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
