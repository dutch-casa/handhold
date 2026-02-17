import { useQuery } from "@tanstack/react-query";
import { getLineDiff, type LineChange } from "@/lab/tauri/git";

const EMPTY: readonly LineChange[] = [];

export function useGitDiff(path: string | undefined): readonly LineChange[] {
  const { data } = useQuery({
    queryKey: ["git-diff", path],
    queryFn: () => getLineDiff(path!),
    enabled: path !== undefined,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  return data ?? EMPTY;
}
