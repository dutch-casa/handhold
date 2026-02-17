import { ExplorerPanel } from "@/lab/ExplorerPanel";
import { InstructionsPanel } from "@/lab/InstructionsPanel";
import { TestRunnerPanel } from "@/lab/TestRunnerPanel";
import { SettingsPanel } from "@/lab/SettingsPanel";
import { ServicePanel, type ServicePanelProps } from "@/lab/ServicePanel";
import { SearchPanel } from "@/lab/SearchPanel";
import type { LabFilesSlice, LabTestSlice } from "@/lab/use-lab";
import type { SidebarPanel } from "@/types/settings";

type SidebarContentProps = {
  readonly activePanel: SidebarPanel;
  readonly files: LabFilesSlice;
  readonly test: LabTestSlice;
  readonly services: ServicePanelProps;
  readonly instructions: string;
  readonly onFileSelect: (path: string) => void;
  readonly onGoToLine?: (line: number) => void;
};

export function SidebarContent({ activePanel, files, test, services, instructions, onFileSelect, onGoToLine }: SidebarContentProps) {
  return (
    <>
      <div className={activePanel !== "explorer" ? "hidden" : "flex h-full flex-col"}>
        <ExplorerPanel files={files} />
      </div>
      <div className={activePanel !== "instructions" ? "hidden" : "flex h-full flex-col"}>
        <InstructionsPanel instructions={instructions} />
      </div>
      <div className={activePanel !== "search" ? "hidden" : "flex h-full flex-col"}>
        <SearchPanel
          workspacePath={files.rootPath}
          onFileSelect={onFileSelect}
          onGoToLine={onGoToLine}
        />
      </div>
      <div className={activePanel !== "services" ? "hidden" : "flex h-full flex-col"}>
        <ServicePanel {...services} />
      </div>
      <div className={activePanel !== "testing" ? "hidden" : "flex h-full flex-col"}>
        <TestRunnerPanel testRun={test.testRun} onRun={test.run} />
      </div>
      <div className={activePanel !== "settings" ? "hidden" : "flex h-full flex-col"}>
        <SettingsPanel />
      </div>
    </>
  );
}
