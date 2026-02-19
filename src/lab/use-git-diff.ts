import { useQuery } from "@tanstack/react-query";
import { getLineDiff, type LineChange } from "@/lab/tauri/git";

const EMPTY: readonly LineChange[] = [];

export function useGitDiff(path: string | undefined, workspace: string): readonly LineChange[] {
  const { data } = useQuery({
    queryKey: ["git-diff", workspace, path],
    queryFn: () => getLineDiff(path!, workspace),
    enabled: path !== undefined,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  return data ?? EMPTY;
}
