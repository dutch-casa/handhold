import { useQuery } from "@tanstack/react-query";
import { getGitStatus, type GitFileStatus } from "@/lab/tauri/git";

const EMPTY: ReadonlyMap<string, GitFileStatus> = new Map();

export function useGitStatus(workspacePath: string): ReadonlyMap<string, GitFileStatus> {
  const { data } = useQuery({
    queryKey: ["git-status", workspacePath],
    queryFn: async () => {
      const entries = await getGitStatus(workspacePath);
      const map = new Map<string, GitFileStatus>();
      for (const entry of entries) {
        map.set(`${workspacePath}/${entry.path}`, entry.status);
      }
      return map as ReadonlyMap<string, GitFileStatus>;
    },
    staleTime: 3_000,
    refetchInterval: 3_000,
    refetchOnWindowFocus: true,
  });

  return data ?? EMPTY;
}
