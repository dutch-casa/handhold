import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { readTree, watch } from "@/lab/tauri/workspace";
import { buildFileTree } from "@/lab/store";
import type { FileTreeNode } from "@/types/lab";

// React Query for file tree. Watcher invalidates on any fs change.
// Returns derived tree (not flat entries) — consumer never sees FsEntry.

export function useFileTree(workspacePath: string | undefined): {
  tree: readonly FileTreeNode[];
  loading: boolean;
  refresh: () => void;
} {
  const queryClient = useQueryClient();

  const { data: entries, isLoading } = useQuery({
    queryKey: ["file-tree", workspacePath],
    queryFn: () => readTree(workspacePath!),
    enabled: workspacePath !== undefined,
    staleTime: Infinity,
  });

  // Wire up fs watcher → invalidate query on change
  useEffect(() => {
    if (workspacePath === undefined) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    watch(workspacePath, () => {
      if (!disposed) {
        queryClient.invalidateQueries({ queryKey: ["file-tree", workspacePath] });
      }
    }).then((disposable) => {
      if (disposed) {
        disposable.dispose();
      } else {
        cleanup = () => disposable.dispose();
      }
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [workspacePath, queryClient]);

  const tree =
    entries !== undefined && workspacePath !== undefined
      ? buildFileTree(entries, workspacePath)
      : [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["file-tree", workspacePath] });
  };

  return { tree, loading: isLoading, refresh };
}
