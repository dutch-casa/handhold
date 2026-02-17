import { useEffect, type ReactNode } from "react";
import { Group, Panel, Separator, usePanelRef } from "react-resizable-panels";

type LabLayoutProps = {
  readonly activityBar: ReactNode;
  readonly sidebar: ReactNode;
  readonly editor: ReactNode;
  readonly bottomPanel: ReactNode;
  readonly statusBar: ReactNode;
  readonly sidebarCollapsed: boolean;
};

function ResizeHandle({ direction }: { readonly direction: "horizontal" | "vertical" }) {
  return (
    <Separator
      className={`group relative ${
        direction === "horizontal" ? "w-px" : "h-px"
      } bg-border transition-colors data-[active]:bg-primary`}
    >
      <div
        className={`absolute touch-none ${
          direction === "horizontal"
            ? "inset-y-0 -left-1 -right-1 cursor-col-resize"
            : "inset-x-0 -top-1 -bottom-1 cursor-row-resize"
        }`}
      />
    </Separator>
  );
}

export function LabLayout({
  activityBar,
  sidebar,
  editor,
  bottomPanel,
  statusBar,
  sidebarCollapsed,
}: LabLayoutProps) {
  const sidebarRef = usePanelRef();

  // Sync sidebar collapse state with the imperative Panel handle
  useEffect(() => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (sidebarCollapsed) {
      panel.collapse();
    } else {
      panel.expand();
    }
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <div className="flex flex-1 overflow-hidden">
        {activityBar}
        <div className="flex-1 overflow-hidden">
          <Group orientation="horizontal" style={{ height: "100%" }}>
            <Panel
              panelRef={sidebarRef}
              defaultSize={20}
              minSize={12}
              collapsible
              collapsedSize={0}
            >
              <div className="flex h-full flex-col overflow-hidden border-r border-border">
                {sidebar}
              </div>
            </Panel>
            <ResizeHandle direction="horizontal" />
            <Panel defaultSize={80} minSize={25}>
              <Group orientation="vertical" style={{ height: "100%" }}>
                <Panel defaultSize={65} minSize={20}>
                  <div className="h-full overflow-hidden">
                    {editor}
                  </div>
                </Panel>
                <ResizeHandle direction="vertical" />
                <Panel defaultSize={35} minSize={15}>
                  <div className="h-full overflow-hidden">
                    {bottomPanel}
                  </div>
                </Panel>
              </Group>
            </Panel>
          </Group>
        </div>
      </div>
      {statusBar}
    </div>
  );
}
