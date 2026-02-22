import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  useLayoutStore,
  getBreakpoint,
  SIDEBAR_MIN,
  PANEL_MIN,
} from "@/editor/viewmodel/layout-store";

// ── Compound component slots ──────────────────────────────────────
// Each slot reads visibility/size from the layout store.
// If not visible, it unmounts entirely (saves resources on small screens).

function Sidebar({ children }: { readonly children: ReactNode }) {
  const visible = useLayoutStore((s) => s.sidebarVisible);
  const width = useLayoutStore((s) => s.sidebarWidth);

  if (!visible) return null;

  return (
    <div
      className="h-full shrink-0 overflow-hidden border-r border-border bg-sidebar"
      style={{ width }}
    >
      {children}
    </div>
  );
}

function Canvas({ children }: { readonly children: ReactNode }) {
  return (
    <div className="h-full min-w-0 flex-1 overflow-hidden">
      {children}
    </div>
  );
}

function Panel({ children }: { readonly children: ReactNode }) {
  const visible = useLayoutStore((s) => s.panelVisible);
  const width = useLayoutStore((s) => s.panelWidth);
  const breakpoint = useLayoutStore((s) => s.breakpoint);

  if (!visible) return null;

  if (breakpoint === "md") {
    return (
      <div
        className="absolute top-0 right-0 z-20 h-full overflow-hidden border-l border-border bg-card shadow-elevation-3"
        style={{ width }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="h-full shrink-0 overflow-hidden border-l border-border bg-card"
      style={{ width }}
    >
      {children}
    </div>
  );
}

function BottomBar({ children }: { readonly children: ReactNode }) {
  const visible = useLayoutStore((s) => s.bottomBarVisible);
  const height = useLayoutStore((s) => s.bottomBarHeight);

  if (!visible) return null;

  return (
    <div
      className="w-full shrink-0 overflow-hidden border-t border-border bg-card"
      style={{ height }}
    >
      {children}
    </div>
  );
}

// ── Resize handle ─────────────────────────────────────────────────
// Thin draggable strip between columns/rows. Pointer capture for
// reliable cross-element dragging. Double-click toggles collapse.

type ResizeHandleProps = {
  readonly direction: "horizontal" | "vertical";
  readonly onDrag: (delta: number) => void;
  readonly onDoubleClick?: () => void;
};

function ResizeHandle({ direction, onDrag, onDoubleClick }: ResizeHandleProps) {
  const [dragging, setDragging] = useState(false);
  const startPos = useRef(0);

  const isHorizontal = direction === "horizontal";

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      startPos.current = isHorizontal ? e.clientX : e.clientY;
    },
    [isHorizontal],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragging) return;
      const current = isHorizontal ? e.clientX : e.clientY;
      const delta = current - startPos.current;
      startPos.current = current;
      onDrag(delta);
    },
    [dragging, isHorizontal, onDrag],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDragging(false);
    },
    [],
  );

  return (
    <div
      className={`
        group relative select-none touch-none
        ${isHorizontal ? "w-[var(--hairline)] cursor-col-resize" : "h-[var(--hairline)] cursor-row-resize"}
        bg-border transition-colors duration-fast
        ${dragging ? "bg-primary" : ""}
      `}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={onDoubleClick}
    >
      {/* Expanded hit area — 8px wide/tall */}
      <div
        className={`absolute ${
          isHorizontal
            ? "inset-y-0 -left-[4px] -right-[4px]"
            : "inset-x-0 -top-[4px] -bottom-[4px]"
        }`}
      />
      {/* Hover indicator */}
      <div
        className={`
          pointer-events-none absolute opacity-0 transition-opacity duration-fast
          ${isHorizontal ? "inset-y-0 -left-[1px] -right-[1px]" : "inset-x-0 -top-[1px] -bottom-[1px]"}
          bg-primary
          ${dragging ? "opacity-100" : ""}
        `}
      />
    </div>
  );
}

// ── Mobile toggle buttons ─────────────────────────────────────────

function SidebarToggle() {
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const toggle = useLayoutStore((s) => s.toggleSidebar);

  if (sidebarVisible) return null;

  return (
    <button
      onClick={toggle}
      className="fixed left-3 top-14 z-30 flex h-11 w-11 items-center justify-center rounded-md bg-card border border-border shadow-elevation-2 press focus-ring"
      aria-label="Toggle sidebar"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M3 5h14M3 10h14M3 15h14" />
      </svg>
    </button>
  );
}

function PanelToggle() {
  const panelVisible = useLayoutStore((s) => s.panelVisible);
  const toggle = useLayoutStore((s) => s.togglePanel);

  if (panelVisible) return null;

  return (
    <button
      onClick={toggle}
      className="fixed right-3 top-14 z-30 flex h-11 w-11 items-center justify-center rounded-md bg-card border border-border shadow-elevation-2 press focus-ring"
      aria-label="Toggle panel"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M12 3v14" />
      </svg>
    </button>
  );
}

// ── Main Layout ───────────────────────────────────────────────────
// Responsive 3-column grid with resize handles and breakpoint detection.

type LayoutProps = {
  readonly children: ReactNode;
};

function findSlot<T>(children: ReactNode, SlotComponent: React.FC<T>): ReactNode {
  const arr = Array.isArray(children) ? children : [children];
  for (const child of arr) {
    if (
      child !== null &&
      child !== undefined &&
      typeof child === "object" &&
      "type" in child &&
      child.type === SlotComponent
    ) {
      return child;
    }
  }
  return null;
}

export function Layout({ children }: LayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  const setBreakpoint = useLayoutStore((s) => s.setBreakpoint);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const panelVisible = useLayoutStore((s) => s.panelVisible);
  const bottomBarVisible = useLayoutStore((s) => s.bottomBarVisible);
  const breakpoint = useLayoutStore((s) => s.breakpoint);

  const setSidebarWidth = useLayoutStore((s) => s.setSidebarWidth);
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth);
  const setPanelWidth = useLayoutStore((s) => s.setPanelWidth);
  const panelWidth = useLayoutStore((s) => s.panelWidth);
  const setBottomBarHeight = useLayoutStore((s) => s.setBottomBarHeight);
  const togglePanel = useLayoutStore((s) => s.togglePanel);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      setBreakpoint(getBreakpoint(width));
    });

    observer.observe(el);
    setBreakpoint(getBreakpoint(el.clientWidth));

    return () => observer.disconnect();
  }, [setBreakpoint]);

  const clampToMax = useCallback(
    (value: number, min: number) => {
      const el = rootRef.current;
      if (!el) return Math.max(min, value);
      const maxW = el.clientWidth * 0.4;
      return Math.max(min, Math.min(maxW, value));
    },
    [],
  );

  const handleSidebarDrag = useCallback(
    (delta: number) => {
      const clamped = clampToMax(sidebarWidth + delta, SIDEBAR_MIN);
      setSidebarWidth(clamped);
    },
    [sidebarWidth, setSidebarWidth, clampToMax],
  );

  const handlePanelDrag = useCallback(
    (delta: number) => {
      const clamped = clampToMax(panelWidth - delta, PANEL_MIN);
      setPanelWidth(clamped);
    },
    [panelWidth, setPanelWidth, clampToMax],
  );

  const handleBottomBarDrag = useCallback(
    (delta: number) => {
      setBottomBarHeight(
        useLayoutStore.getState().bottomBarHeight - delta,
      );
    },
    [setBottomBarHeight],
  );

  const sidebarSlot = findSlot(children, Sidebar);
  const canvasSlot = findSlot(children, Canvas);
  const panelSlot = findSlot(children, Panel);
  const bottomBarSlot = findSlot(children, BottomBar);

  const panelIsOverlay = breakpoint === "md" && panelVisible;

  return (
    <div ref={rootRef} className="relative flex h-full w-full flex-col bg-background text-foreground">
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {sidebarSlot}

        {sidebarVisible && !panelIsOverlay && (
          <ResizeHandle
            direction="horizontal"
            onDrag={handleSidebarDrag}
            onDoubleClick={toggleSidebar}
          />
        )}

        {canvasSlot}

        {panelVisible && !panelIsOverlay && (
          <ResizeHandle
            direction="horizontal"
            onDrag={handlePanelDrag}
            onDoubleClick={togglePanel}
          />
        )}

        {!panelIsOverlay && panelSlot}

        {panelIsOverlay && panelSlot}

        {panelIsOverlay && (
          <div
            className="absolute inset-0 z-10 bg-black/30"
            onClick={togglePanel}
          />
        )}
      </div>

      {bottomBarVisible && (
        <ResizeHandle
          direction="vertical"
          onDrag={handleBottomBarDrag}
        />
      )}
      {bottomBarSlot}

      <SidebarToggle />
      <PanelToggle />
    </div>
  );
}

Layout.Sidebar = Sidebar;
Layout.Canvas = Canvas;
Layout.Panel = Panel;
Layout.BottomBar = BottomBar;
