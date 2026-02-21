import { useMemo } from "react";
import { Files, BookOpen, Search, Container, FlaskConical, Settings, Lightbulb } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSettingsStore } from "@/lab/settings-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SidebarPanel } from "@/types/settings";

type ActivityBarEntry = {
  readonly panel: SidebarPanel;
  readonly icon: LucideIcon;
  readonly label: string;
};

const BASE_ITEMS: readonly ActivityBarEntry[] = [
  { panel: "explorer", icon: Files, label: "Explorer" },
  { panel: "instructions", icon: BookOpen, label: "Instructions" },
  { panel: "search", icon: Search, label: "Search" },
  { panel: "services", icon: Container, label: "Services" },
  { panel: "testing", icon: FlaskConical, label: "Testing" },
];

const SOLUTION_ITEM: ActivityBarEntry = { panel: "solution", icon: Lightbulb, label: "Solution" };
const SETTINGS_ITEM: ActivityBarEntry = { panel: "settings", icon: Settings, label: "Settings" };

type ActivityBarProps = {
  readonly solutionAvailable?: boolean | undefined;
};

export function ActivityBar({ solutionAvailable = false }: ActivityBarProps) {
  const items = useMemo(
    () => solutionAvailable ? [...BASE_ITEMS, SOLUTION_ITEM, SETTINGS_ITEM] : [...BASE_ITEMS, SETTINGS_ITEM],
    [solutionAvailable],
  );
  const activePanel = useSettingsStore((s) => s.sidebarPanel);
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const setSidebarPanel = useSettingsStore((s) => s.setSidebarPanel);

  return (
    <TooltipProvider delay={400}>
      <div className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-[#0e0e0e] pt-2">
        {items.map((entry) => {
          const Icon = entry.icon;
          const active = entry.panel === activePanel && !collapsed;
          return (
            <Tooltip key={entry.panel}>
              <TooltipTrigger
                onClick={() => setSidebarPanel(entry.panel)}
                aria-label={entry.label}
                className={`focus-ring relative flex w-full items-center justify-center py-3 transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active ? (
                  <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-primary" />
                ) : null}
                <Icon className="size-5" strokeWidth={active ? 2 : 1.5} />
              </TooltipTrigger>
              <TooltipContent side="right">{entry.label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
