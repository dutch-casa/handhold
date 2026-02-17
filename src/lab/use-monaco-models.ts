import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { readTsProjectFiles, readTypeDefinitions } from "@/lab/tauri/typescript";
import { seedModels, seedExtraLibs, disposeAllModels } from "@/lab/monaco-models";
import { watch } from "@/lab/tauri/workspace";

export function useMonacoModels(workspacePath: string | undefined): { readonly ready: boolean } {
  const queryClient = useQueryClient();
  const srcQueryKey = ["ts-project-files", workspacePath];

  const srcQuery = useQuery({
    queryKey: srcQueryKey,
    queryFn: async () => {
      const files = await readTsProjectFiles(workspacePath!);
      seedModels(files);
      return files;
    },
    enabled: workspacePath !== undefined,
    staleTime: Infinity,
  });

  const typesQuery = useQuery({
    queryKey: ["type-definitions", workspacePath],
    queryFn: async () => {
      const files = await readTypeDefinitions(workspacePath!);
      seedExtraLibs(files);
      return files;
    },
    enabled: workspacePath !== undefined,
    staleTime: Infinity,
  });

  // Reseed models when files change on disk (terminal commands, git ops, etc.)
  useEffect(() => {
    if (workspacePath === undefined) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    watch(workspacePath, () => {
      if (!disposed) {
        queryClient.invalidateQueries({ queryKey: srcQueryKey });
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
      disposeAllModels();
    };
  }, [workspacePath, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps

  return { ready: srcQuery.isSuccess && typesQuery.isSuccess };
}
