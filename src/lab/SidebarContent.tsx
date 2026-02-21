import { ExplorerPanel } from "@/lab/ExplorerPanel";
import { InstructionsPanel } from "@/lab/InstructionsPanel";
import { TestRunnerPanel } from "@/lab/TestRunnerPanel";
import { SettingsPanel } from "@/lab/SettingsPanel";
import { ServicePanel, type ServicePanelProps } from "@/lab/ServicePanel";
import { SearchPanel } from "@/lab/SearchPanel";
import { SolutionPanel } from "@/lab/SolutionPanel";
import type { LabFilesSlice, LabTestSlice, LabSolutionSlice } from "@/lab/use-lab";
import type { SidebarPanel } from "@/types/settings";

type SidebarContentProps = {
  readonly activePanel: SidebarPanel;
  readonly files: LabFilesSlice;
  readonly test: LabTestSlice;
  readonly services: ServicePanelProps;
  readonly solution: LabSolutionSlice;
  readonly instructions: string;
  readonly onFileSelect: (path: string) => void;
  readonly onGoToLine?: (line: number) => void;
  readonly onViewSolution?: (() => void) | undefined;
};

export function SidebarContent({ activePanel, files, test, services, solution, instructions, onFileSelect, onGoToLine, onViewSolution }: SidebarContentProps) {
  return (
    <>
      <div className={activePanel !== "explorer" ? "hidden" : "flex h-full flex-col"}>
        <ExplorerPanel files={files} />
      </div>
      <div className={activePanel !== "instructions" ? "hidden" : "flex h-full flex-col"}>
        <InstructionsPanel instructions={instructions} onViewSolution={onViewSolution} />
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
      {solution.available && solution.solutionPath !== undefined ? (
        <div className={activePanel !== "solution" ? "hidden" : "flex h-full flex-col"}>
          <SolutionPanel solutionPath={solution.solutionPath} onOpenSolution={solution.openSolution} />
        </div>
      ) : null}
      <div className={activePanel !== "settings" ? "hidden" : "flex h-full flex-col"}>
        <SettingsPanel />
      </div>
    </>
  );
}
