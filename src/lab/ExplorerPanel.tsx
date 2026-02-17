import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileExplorer } from "@/lab/FileExplorer";
import type { LabFilesSlice } from "@/lab/use-lab";

// Explorer panel: collapsible "FILES" section wrapping the file tree.
// ScrollArea handles overflow with styled thin scrollbar.

export function ExplorerPanel({ files }: { readonly files: LabFilesSlice }) {
  return (
    <div className="flex h-full flex-col">
      <Collapsible defaultOpen className="flex flex-1 flex-col overflow-hidden">
        <CollapsibleTrigger className="ide-section-header border-b border-border">
          <ChevronRight className="size-3 shrink-0 transition-transform group-data-[state=open]:rotate-90" />
          <span>Files</span>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <FileExplorer
              tree={files.tree}
              loading={files.loading}
              onSelect={files.select}
              ops={files.ops}
            />
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
