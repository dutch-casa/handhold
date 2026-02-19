import { useState } from "react";
import { ChevronRight, FilePlus, FolderPlus, RefreshCw, ChevronsDownUp, Search } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileExplorer } from "@/lab/FileExplorer";
import { useGitStatus } from "@/lab/use-git-status";
import type { LabFilesSlice } from "@/lab/use-lab";

type RootCreating = "new-file" | "new-folder";

export function ExplorerPanel({ files }: { readonly files: LabFilesSlice }) {
  const [filter, setFilter] = useState("");
  const [collapseKey, setCollapseKey] = useState(0);
  const [rootCreating, setRootCreating] = useState<RootCreating | undefined>(undefined);
  const [showFilter, setShowFilter] = useState(false);

  const gitStatus = useGitStatus(files.rootPath);

  return (
    <div className="flex h-full flex-col">
      <Collapsible defaultOpen className="flex flex-1 flex-col overflow-hidden">
        <CollapsibleTrigger className="ide-section-header border-b border-border">
          <ChevronRight className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
          <span>Files</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-0.5 border-b border-border px-1.5 py-1">
            <ToolbarButton
              label="New File"
              onClick={() => setRootCreating("new-file")}
            >
              <FilePlus className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="New Folder"
              onClick={() => setRootCreating("new-folder")}
            >
              <FolderPlus className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Refresh"
              onClick={files.refresh}
            >
              <RefreshCw className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Collapse All"
              onClick={() => setCollapseKey((k) => k + 1)}
            >
              <ChevronsDownUp className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              label="Filter"
              onClick={() => setShowFilter((v) => !v)}
            >
              <Search className="size-3.5" />
            </ToolbarButton>
          </div>

          {showFilter && (
            <div className="border-b border-border px-1.5 py-1">
              <input
                type="text"
                placeholder="Filter files..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-5 w-full rounded border border-border bg-background px-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                autoFocus
              />
            </div>
          )}

          <ScrollArea className="flex-1">
            <FileExplorer
              tree={files.tree}
              loading={files.loading}
              rootPath={files.rootPath}
              onSelect={files.select}
              ops={files.ops}
              filter={filter}
              collapseKey={collapseKey}
              rootCreating={rootCreating}
              setRootCreating={setRootCreating}
              gitStatus={gitStatus}
            />
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
