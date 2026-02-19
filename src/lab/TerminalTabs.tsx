import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import type { TerminalTabView } from "@/lab/use-lab";

type TerminalTabsProps = {
  readonly tabs: readonly TerminalTabView[];
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onSpawn: () => void;
  readonly onRename: (id: string, title: string) => void;
  readonly onReorder: (oldIndex: number, newIndex: number) => void;
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
  onReorder,
}: TerminalTabsProps) {
  const [renamingId, setRenamingId] = useState<string | undefined>(undefined);

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const source = event.operation?.source;
        const target = event.operation?.target;
        if (!source || !target) return;

        const oldIndex = tabs.findIndex((t) => t.id === String(source.id));
        const newIndex = tabs.findIndex((t) => t.id === String(target.id));
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        onReorder(oldIndex, newIndex);
      }}
    >
      <div className="ide-tab-bar ide-scrollbar">
        {tabs.map((tab, index) => (
          <SortableTerminalTab
            key={tab.id}
            tab={tab}
            index={index}
            renamingId={renamingId}
            onSelect={onSelect}
            onClose={onClose}
            onRename={onRename}
            setRenamingId={setRenamingId}
          />
        ))}
        <button
          onClick={onSpawn}
          className="focus-ring flex items-center px-2.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="New terminal"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <DragOverlay>
        {(source) => {
          const tab = tabs.find((t) => t.id === String(source.id));
          if (!tab) return null;
          return (
            <div className="ide-tab flex items-center gap-1.5 rounded bg-popover px-3 py-1 text-xs text-foreground shadow-lg ring-1 ring-foreground/10">
              <span>{tab.title}</span>
            </div>
          );
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}

function SortableTerminalTab({
  tab,
  index,
  renamingId,
  onSelect,
  onClose,
  onRename,
  setRenamingId,
}: {
  readonly tab: TerminalTabView;
  readonly index: number;
  readonly renamingId: string | undefined;
  readonly onSelect: (id: string) => void;
  readonly onClose: (id: string) => void;
  readonly onRename: (id: string, title: string) => void;
  readonly setRenamingId: (id: string | undefined) => void;
}) {
  const { ref, isDragging } = useSortable({ id: tab.id, index });

  return (
    <button
      ref={ref}
      data-active={tab.active}
      onClick={() => onSelect(tab.id)}
      onDoubleClick={() => setRenamingId(tab.id)}
      className={`ide-tab focus-ring ${isDragging ? "opacity-40" : ""}`}
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
  );
}
