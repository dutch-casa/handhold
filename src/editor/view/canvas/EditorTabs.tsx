// Editor tab bar — horizontal strip above the canvas.
// Uses ide-tab-bar / ide-tab / ide-tab-close utility classes from index.css.
// Drag-to-reorder via HTML5 DnD. Overflow: horizontal scroll with fade masks.

import { useRef, useState, useCallback, useEffect, type DragEvent, type MouseEvent } from "react";
import { useCourseEditorStore } from "@/editor/viewmodel/course-editor-store";
import type { EditorTab } from "@/editor/model/types";

// ── Tab item ─────────────────────────────────────────────────────

type TabItemProps = {
  readonly tab: EditorTab;
  readonly active: boolean;
  readonly onActivate: () => void;
  readonly onClose: () => void;
  readonly onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  readonly onDragOver: (e: DragEvent<HTMLDivElement>) => void;
  readonly onDrop: (e: DragEvent<HTMLDivElement>) => void;
  readonly dragOver: boolean;
};

function TabItem({
  tab,
  active,
  onActivate,
  onClose,
  onDragStart,
  onDragOver,
  onDrop,
  dragOver,
}: TabItemProps) {
  const handleAuxClick = useCallback(
    (e: MouseEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  const handleCloseClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose],
  );

  return (
    <div
      role="tab"
      aria-selected={active}
      aria-label={tab.label}
      data-active={active}
      data-tab-id={tab.id}
      className={`ide-tab group relative cursor-pointer select-none ${
        dragOver ? "border-l-2 border-l-primary" : ""
      }`}
      draggable
      onClick={onActivate}
      onAuxClick={handleAuxClick}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {tab.pinned && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="currentColor"
          className="shrink-0 opacity-50"
          aria-hidden="true"
        >
          <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1-.707.707l-.586-.585-2.82 2.82.385.385a.5.5 0 0 1-.707.707L8.5 7.655l-3.889 3.889a.5.5 0 0 1-.707-.707L7.793 6.95 5.596 4.753l-.585-.585a.5.5 0 0 1 .707-.708l.385.386 2.82-2.82-.586-.586a.5.5 0 0 1 .147-.354z" />
        </svg>
      )}

      <span className="max-w-[120px] truncate">{tab.label}</span>

      {tab.dirty && (
        <span
          className="h-[6px] w-[6px] shrink-0 rounded-full bg-primary"
          aria-label="Unsaved changes"
        />
      )}

      {!tab.pinned && (
        <button
          className="ide-tab-close"
          onClick={handleCloseClick}
          aria-label={`Close ${tab.label}`}
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── EditorTabs ───────────────────────────────────────────────────

export function EditorTabs() {
  const tabs = useCourseEditorStore((s) => s.tabs);
  const activeTabId = useCourseEditorStore((s) => s.activeTabId);
  const activateTab = useCourseEditorStore((s) => s.activateTab);
  const closeTab = useCourseEditorStore((s) => s.closeTab);

  const scrollRef = useRef<HTMLDivElement>(null);
  const dragSourceId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Scroll-fade: detect overflow and scroll position.
  const updateFade = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeftFade(el.scrollLeft > 1);
    setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    updateFade();
    el.addEventListener("scroll", updateFade, { passive: true });
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", updateFade);
      ro.disconnect();
    };
  }, [updateFade, tabs.length]);

  // ── Drag handlers ──────────────────────────────────────────────

  const handleDragStart = useCallback(
    (tabId: string) => (e: DragEvent<HTMLDivElement>) => {
      dragSourceId.current = tabId;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", tabId);
    },
    [],
  );

  const handleDragOver = useCallback(
    (tabId: string) => (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverId(tabId);
    },
    [],
  );

  const handleDrop = useCallback(
    (targetId: string) => (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOverId(null);

      const sourceId = dragSourceId.current;
      if (!sourceId) return;
      if (sourceId === targetId) return;

      const { tabs: currentTabs } = useCourseEditorStore.getState();
      const fromIdx = currentTabs.findIndex((t) => t.id === sourceId);
      const toIdx = currentTabs.findIndex((t) => t.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return;

      const reordered = [...currentTabs];
      const [moved] = reordered.splice(fromIdx, 1);
      if (!moved) return;
      reordered.splice(toIdx, 0, moved);
      useCourseEditorStore.setState({ tabs: reordered });
    },
    [],
  );

  const handleDragEnd = useCallback(() => {
    dragSourceId.current = null;
    setDragOverId(null);
  }, []);

  if (tabs.length === 0) return null;

  return (
    <div className="relative" onDragEnd={handleDragEnd}>
      {showLeftFade && (
        <div
          className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6"
          style={{ background: "linear-gradient(to right, var(--background), transparent)" }}
          aria-hidden="true"
        />
      )}

      <div
        ref={scrollRef}
        role="tablist"
        aria-label="Editor tabs"
        className="ide-tab-bar ide-scrollbar"
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onActivate={() => activateTab(tab.id)}
            onClose={() => closeTab(tab.id)}
            onDragStart={handleDragStart(tab.id)}
            onDragOver={handleDragOver(tab.id)}
            onDrop={handleDrop(tab.id)}
            dragOver={dragOverId === tab.id}
          />
        ))}
      </div>

      {showRightFade && (
        <div
          className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6"
          style={{ background: "linear-gradient(to left, var(--background), transparent)" }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
