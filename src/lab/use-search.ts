import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { searchWorkspace, type SearchOpts, type SearchResult } from "@/lab/tauri/search";

export function useSearch(root: string, query: string, opts: SearchOpts) {
  return useQuery<SearchResult>({
    queryKey: ["workspace-search", root, query, opts.caseSensitive, opts.regex, opts.wholeWord],
    queryFn: () => searchWorkspace(root, query, opts),
    enabled: query.length >= 2,
    staleTime: 5_000,
    placeholderData: keepPreviousData,
  });
}
