import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { readFile, writeFile } from "@/lab/tauri/file";

// React Query for file content. Read is async + cached; write is imperative.
// Invalidates cache on save so re-reads get fresh data.

export function useFile(path: string | undefined) {
  const queryClient = useQueryClient();

  const { data: content, isLoading } = useQuery({
    queryKey: ["file", path],
    queryFn: () => readFile(path!),
    enabled: path !== undefined,
    staleTime: Infinity,
  });

  const save = useCallback(
    async (newContent: string) => {
      if (path === undefined) return;
      await writeFile(path, newContent);
      queryClient.setQueryData(["file", path], newContent);
    },
    [path, queryClient],
  );

  return { content, save, loading: isLoading };
}
