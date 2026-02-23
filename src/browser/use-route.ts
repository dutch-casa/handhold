import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/browser/tauri";
import type { Route } from "@/types/browser";

const ROUTE_KEY = ["app-route"] as const;

export function useRoute() {
  const qc = useQueryClient();

  const { data: route } = useQuery({
    queryKey: ROUTE_KEY,
    queryFn: async () => {
      const stored = await api.routeLoad();
      if (stored.kind !== "browser" && stored.kind !== "course") return { kind: "browser" as const };
      return stored;
    },
    staleTime: Infinity,
  });

  const { mutate: navigate } = useMutation({
    mutationFn: api.routeSave,
    onMutate: (next: Route) => {
      // Optimistic — instant UI response
      qc.setQueryData(ROUTE_KEY, next);
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ROUTE_KEY });
    },
  });

  return {
    route: route ?? ({ kind: "browser" } as const satisfies Route),
    navigate,
  } as const;
}
