import { useState, type ReactNode } from "react";
import { useDiagnosticsStore } from "@/lab/diagnostics-store";

type BottomPanelTab = "terminal" | "problems";

type BottomPanelProps = {
  readonly terminal: ReactNode;
  readonly diagnostics: ReactNode;
};

function Badge({ count, color }: { readonly count: number; readonly color: string }) {
  if (count === 0) return null;
  return (
    <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${color}`}>
      {count}
    </span>
  );
}

const TABS: readonly { readonly id: BottomPanelTab; readonly label: string }[] = [
  { id: "terminal", label: "Terminal" },
  { id: "problems", label: "Problems" },
];

export function BottomPanel({ terminal, diagnostics }: BottomPanelProps) {
  const [activeTab, setActiveTab] = useState<BottomPanelTab>("terminal");
  const errorCount = useDiagnosticsStore((s) => s.errorCount);
  const warningCount = useDiagnosticsStore((s) => s.warningCount);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center border-b border-border bg-[#0e0e0e]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.id === "problems" ? (
              <>
                <Badge count={errorCount} color="bg-red-900/60 text-red-400" />
                <Badge count={warningCount} color="bg-yellow-900/60 text-yellow-400" />
              </>
            ) : null}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className={activeTab !== "terminal" ? "hidden" : "h-full"}>
          {terminal}
        </div>
        <div className={activeTab !== "problems" ? "hidden" : "h-full"}>
          {diagnostics}
        </div>
      </div>
    </div>
  );
}
