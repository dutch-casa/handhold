import { X } from "lucide-react";
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
};

export function EditorTabs({ tabs, onSelect, onClose, onCloseOthers, onCloseAll, onCloseSaved }: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="ide-tab-bar ide-scrollbar">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <ContextMenu key={tab.path}>
            <ContextMenuTrigger className="ide-tab focus-ring" data-active={tab.active} onClick={() => onSelect(tab.path)}>
              <Icon className="size-3.5 shrink-0" style={{ color: tab.iconColor }} />
              <span>{tab.name}</span>
              {tab.dirty ? (
                <span className="size-1.5 shrink-0 rounded-full bg-primary" />
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
              <ContextMenuItem onSelect={() => onClose(tab.path)}>Close</ContextMenuItem>
              <ContextMenuItem onSelect={() => onCloseOthers(tab.path)}>Close Others</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={onCloseAll}>Close All</ContextMenuItem>
              <ContextMenuItem onSelect={onCloseSaved}>Close Saved</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
