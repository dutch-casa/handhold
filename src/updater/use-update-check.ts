import { check, type Update } from "@tauri-apps/plugin-updater";
import { useQuery } from "@tanstack/react-query";

export function useUpdateCheck() {
  return useQuery({
    queryKey: ["updater", "check"],
    queryFn: async (): Promise<Update | null> => {
      const update = await check();
      return update ?? null;
    },
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}
