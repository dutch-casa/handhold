import { X, Columns2 } from "lucide-react";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { EditorTabView } from "@/lab/use-lab";

type EditorTabsProps = {
  readonly tabs: readonly EditorTabView[];
  readonly onSelect: (path: string) => void;
  readonly onClose: (path: string) => void;
  readonly onCloseOthers: (path: string) => void;
  readonly onCloseAll: () => void;
  readonly onCloseSaved: () => void;
  readonly onReorder: (oldIndex: number, newIndex: number) => void;
  readonly onSplitRight: (path: string) => void;
  readonly isSplit: boolean;
};

export function EditorTabs({ tabs, onSelect, onClose, onCloseOthers, onCloseAll, onCloseSaved, onReorder, onSplitRight, isSplit }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <DragDropProvider
      onDragEnd={(event) => {
        if (event.canceled) return;
        const source = event.operation?.source;
        const target = event.operation?.target;
        if (!source || !target) return;

        const oldIndex = tabs.findIndex((t) => t.path === String(source.id));
        const newIndex = tabs.findIndex((t) => t.path === String(target.id));
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        onReorder(oldIndex, newIndex);
      }}
    >
      <div className="ide-tab-bar ide-scrollbar">
        {tabs.map((tab, index) => (
          <SortableTab
            key={tab.path}
            tab={tab}
            index={index}
            onSelect={onSelect}
            onClose={onClose}
            onCloseOthers={onCloseOthers}
            onCloseAll={onCloseAll}
            onCloseSaved={onCloseSaved}
            onSplitRight={onSplitRight}
            isSplit={isSplit}
          />
        ))}
      </div>

      <DragOverlay>
        {(source) => {
          const tab = tabs.find((t) => t.path === String(source.id));
          if (!tab) return null;
          const Icon = tab.icon;
          return (
            <div className="ide-tab flex items-center gap-1.5 rounded bg-popover px-3 py-1 text-xs text-foreground shadow-lg ring-1 ring-foreground/10">
              <Icon className="size-3.5 shrink-0" style={{ color: tab.iconColor }} />
              <span>{tab.name}</span>
            </div>
          );
        }}
      </DragOverlay>
    </DragDropProvider>
  );
}

function SortableTab({
  tab,
  index,
  onSelect,
  onClose,
  onCloseOthers,
  onCloseAll,
  onCloseSaved,
  onSplitRight,
  isSplit,
}: {
  readonly tab: EditorTabView;
  readonly index: number;
  readonly onSelect: (path: string) => void;
  readonly onClose: (path: string) => void;
  readonly onCloseOthers: (path: string) => void;
  readonly onCloseAll: () => void;
  readonly onCloseSaved: () => void;
  readonly onSplitRight: (path: string) => void;
  readonly isSplit: boolean;
}) {
  const { ref, isDragging } = useSortable({ id: tab.path, index });
  const Icon = tab.icon;

  return (
    <ContextMenu>
      <ContextMenuTrigger
        ref={ref}
        className={`ide-tab focus-ring ${isDragging ? "opacity-40" : ""}`}
        data-active={tab.active}
        onClick={() => onSelect(tab.path)}
      >
        <Icon className="size-3.5 shrink-0" style={{ color: tab.iconColor }} />
        <span>{tab.name}</span>
        {tab.solution ? (
          <span className="ml-0.5 rounded bg-primary/20 px-1 text-[9px] font-medium leading-none text-primary">SOLUTION</span>
        ) : null}
        {tab.dirty ? (
          <span className="size-1.5 shrink-0 rounded-full bg-primary" />
        ) : null}
        {isSplit && tab.pane === "right" ? (
          <span className="ml-0.5 text-[9px] leading-none text-muted-foreground">2</span>
        ) : null}
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onClose(tab.path);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.stopPropagation();
              onClose(tab.path);
            }
          }}
          className="ide-tab-close focus-ring"
          aria-label={`Close ${tab.name}`}
        >
          <X className="size-3" />
        </span>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onClose(tab.path)}>Close</ContextMenuItem>
        <ContextMenuItem onClick={() => onCloseOthers(tab.path)}>Close Others</ContextMenuItem>
        <ContextMenuSeparator />
        {tab.pane !== "right" ? (
          <ContextMenuItem onClick={() => onSplitRight(tab.path)}>
            <Columns2 className="size-3.5" />
            Open to the Side
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onClick={onCloseAll}>Close All</ContextMenuItem>
        <ContextMenuItem onClick={onCloseSaved}>Close Saved</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
