import { useMemo, useState, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { useCommandRegistry } from "@/lab/command-registry";
import { FileIcon } from "@/lab/file-icons";
import { formatKey } from "@/lab/hotkeys/registry";
import type { FileTreeNode } from "@/types/lab";

// Two modes — file search (Cmd+P) and command search (Cmd+Shift+P or ">").
// File mode: manual filtering + virtualized rendering (handles large workspaces).
// Command mode: cmdk handles keyboard nav among pre-filtered CommandItems.
// shouldFilter={false} always — single source of truth for all filtering.

type CommandPaletteProps = {
  readonly open: boolean;
  readonly commandMode: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly files: readonly FileTreeNode[];
  readonly onFileSelect: (path: string) => void;
};

type FileEntry = {
  readonly path: string;
  readonly name: string;
  readonly ext: string;
};

function flattenFiles(nodes: readonly FileTreeNode[]): readonly FileEntry[] {
  const result: FileEntry[] = [];
  const walk = (ns: readonly FileTreeNode[]) => {
    for (const node of ns) {
      if (node.kind === "file") {
        result.push({ path: node.path, name: node.name, ext: node.ext });
      } else {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return result;
}

function relativePath(fullPath: string): string {
  const parts = fullPath.split("/");
  return parts.slice(-3).join("/");
}

export function CommandPalette({
  open,
  commandMode,
  onOpenChange,
  files,
  onFileSelect,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevOpen, setPrevOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commands = useCommandRegistry((s) => s.commands);

  if (open && !prevOpen) {
    setQuery(commandMode ? ">" : "");
    setSelectedIndex(0);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  const flatFiles = useMemo(() => flattenFiles(files), [files]);
  const commandList = useMemo(() => Array.from(commands.values()), [commands]);
  const isCommandMode = query.startsWith(">");
  const commandQuery = isCommandMode ? query.slice(1).trim() : "";

  const filteredFiles = useMemo(() => {
    if (isCommandMode) return [] as FileEntry[];
    const q = query.toLowerCase();
    if (q === "") return flatFiles as FileEntry[];
    return (flatFiles as FileEntry[]).filter((f) =>
      f.name.toLowerCase().includes(q),
    );
  }, [flatFiles, query, isCommandMode]);

  const filteredCommands = useMemo(() => {
    if (!isCommandMode) return commandList;
    if (commandQuery === "") return commandList;
    return commandList.filter((cmd) =>
      cmd.label.toLowerCase().includes(commandQuery.toLowerCase()),
    );
  }, [isCommandMode, commandQuery, commandList]);

  const virtualizer = useVirtualizer({
    count: filteredFiles.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 36,
    overscan: 8,
  });

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setQuery("");
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const selectFile = useCallback(
    (path: string) => {
      onFileSelect(path);
      onOpenChange(false);
      setQuery("");
    },
    [onFileSelect, onOpenChange],
  );

  const handleCommandSelect = useCallback(
    (value: string) => {
      if (value.startsWith("cmd:")) {
        const cmd = commands.get(value.slice(4));
        cmd?.execute();
      }
      onOpenChange(false);
      setQuery("");
    },
    [commands, onOpenChange],
  );

  const handleFileKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isCommandMode) return;
      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          e.stopPropagation();
          const next = Math.min(selectedIndex + 1, filteredFiles.length - 1);
          setSelectedIndex(next);
          virtualizer.scrollToIndex(next, { align: "auto" });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          e.stopPropagation();
          const next = Math.max(selectedIndex - 1, 0);
          setSelectedIndex(next);
          virtualizer.scrollToIndex(next, { align: "auto" });
          break;
        }
        case "Enter": {
          e.preventDefault();
          e.stopPropagation();
          const file = filteredFiles[selectedIndex];
          if (file) selectFile(file.path);
          break;
        }
      }
    },
    [isCommandMode, selectedIndex, filteredFiles, virtualizer, selectFile],
  );

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <Command shouldFilter={false}>
        <div onKeyDown={handleFileKeyDown}>
          <CommandInput
            placeholder={
              isCommandMode
                ? "Run a command..."
                : "Search files by name... (type > for commands)"
            }
            value={query}
            onValueChange={handleQueryChange}
          />
        </div>

        {isCommandMode ? (
          <CommandList>
            {filteredCommands.length === 0 ? (
              <div className="py-6 text-center text-sm">
                No commands found.
              </div>
            ) : (
              <CommandGroup heading="Commands">
                {filteredCommands.map((cmd) => (
                  <CommandItem
                    key={cmd.id}
                    value={`cmd:${cmd.id}`}
                    onSelect={handleCommandSelect}
                  >
                    <span>{cmd.label}</span>
                    {cmd.shortcut !== undefined ? (
                      <CommandShortcut>
                        {formatKey(cmd.shortcut)}
                      </CommandShortcut>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        ) : (
          <div
            ref={scrollRef}
            className="no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1"
          >
            {filteredFiles.length === 0 ? (
              <div className="py-6 text-center text-sm">No files found.</div>
            ) : (
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  width: "100%",
                  position: "relative",
                }}
              >
                {virtualizer.getVirtualItems().map((vi) => {
                  const file = filteredFiles[vi.index];
                  if (!file) return null;
                  return (
                    <div
                      key={file.path}
                      data-selected={
                        vi.index === selectedIndex ? "" : undefined
                      }
                      className="data-selected:bg-muted data-selected:text-foreground absolute left-0 top-0 flex w-full cursor-default items-center gap-2 rounded-lg px-3 text-sm select-none"
                      style={{
                        height: vi.size,
                        transform: `translateY(${vi.start}px)`,
                      }}
                      onClick={() => selectFile(file.path)}
                    >
                      <FileIcon name={file.name} ext={file.ext} />
                      <span>{file.name}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {relativePath(file.path)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Command>
    </CommandDialog>
  );
}
