import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createFile,
  createDir,
  removePath,
  renamePath,
  movePath,
} from "@/lab/tauri/file";

// Deep module: file CRUD operations with automatic cache invalidation.
// All ops invalidate the file tree query so the explorer updates.
// Consumer never thinks about cache — just calls the function.

export type FileOps = {
  readonly createFile: (path: string) => Promise<void>;
  readonly createDir: (path: string) => Promise<void>;
  readonly remove: (path: string) => Promise<void>;
  readonly rename: (from: string, to: string) => Promise<void>;
  readonly move: (from: string, to: string) => Promise<void>;
};

export function useFileOps(workspacePath: string): FileOps {
  const queryClient = useQueryClient();

  const invalidateTree = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["file-tree", workspacePath] });
  }, [queryClient, workspacePath]);

  return {
    createFile: useCallback(
      async (path: string) => {
        await createFile(path);
        invalidateTree();
      },
      [invalidateTree],
    ),

    createDir: useCallback(
      async (path: string) => {
        await createDir(path);
        invalidateTree();
      },
      [invalidateTree],
    ),

    remove: useCallback(
      async (path: string) => {
        await removePath(path);
        invalidateTree();
      },
      [invalidateTree],
    ),

    rename: useCallback(
      async (from: string, to: string) => {
        await renamePath(from, to);
        invalidateTree();
      },
      [invalidateTree],
    ),

    move: useCallback(
      async (from: string, to: string) => {
        await movePath(from, to);
        invalidateTree();
      },
      [invalidateTree],
    ),
  };
}
