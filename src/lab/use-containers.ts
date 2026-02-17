import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  detect,
  listContainers,
  streamLogs,
  containerAction,
  type ContainerInfo,
} from "@/lab/tauri/container";
import type {
  RuntimeState,
  ContainerState,
  ContainerView,
} from "@/types/lab";

// React Query drives runtime detection and container polling.
// Log streaming uses useEffect for external subscription lifecycle
// (not data fetching — managing a persistent websocket-like connection).

type ContainerStoreActions = {
  readonly appendContainerLog: (name: string, line: string) => void;
  readonly clearContainerLogs: (name: string) => void;
};

type UseContainersOpts = {
  readonly composePath: string;
  readonly enabled: boolean;
  readonly serviceCount: number;
  readonly selectedService: string | undefined;
  readonly store: ContainerStoreActions;
};

// Pure: maps raw compose ps output to view-layer discriminated union
function deriveContainerState(info: ContainerInfo): ContainerState {
  const status = info.status.toLowerCase();

  if (status.includes("exited") || status.includes("stopped")) {
    return { kind: "stopped" };
  }
  if (status.includes("dead") || status.includes("removing")) {
    return { kind: "error", message: info.status };
  }

  // Running — derive health
  const health = info.health.toLowerCase();
  if (health === "healthy") return { kind: "running", health: "healthy" };
  if (health === "unhealthy") return { kind: "running", health: "unhealthy" };
  if (health === "starting") return { kind: "running", health: "starting" };
  return { kind: "running", health: "none" };
}

function toContainerView(info: ContainerInfo): ContainerView {
  return {
    name: info.name,
    image: info.image,
    state: deriveContainerState(info),
    ports: info.ports,
  };
}

export type ContainersResult = {
  readonly runtime: RuntimeState;
  readonly containers: readonly ContainerView[];
  readonly performAction: (name: string, action: "start" | "stop" | "restart") => Promise<void>;
};

export function useContainers(opts: UseContainersOpts): ContainersResult {
  const { composePath, enabled, serviceCount, selectedService, store } = opts;
  const queryClient = useQueryClient();

  // Runtime detection — runs once, cached forever
  const runtimeQuery = useQuery({
    queryKey: ["container-runtime"],
    queryFn: detect,
    staleTime: Infinity,
    enabled: serviceCount > 0,
  });

  const runtime: RuntimeState = (() => {
    if (runtimeQuery.isPending) return { kind: "detecting" } as const;
    if (runtimeQuery.error) return { kind: "missing" } as const;
    const data = runtimeQuery.data;
    if (!data) return { kind: "missing" } as const;
    return { kind: "ready", binary: data.binary, version: data.version } as const;
  })();

  // Container list — polls every 5s while enabled
  const containerQuery = useQuery({
    queryKey: ["container-list", composePath],
    queryFn: () => listContainers(composePath),
    refetchInterval: 5000,
    enabled: enabled && runtime.kind === "ready",
    select: (data) => data.map(toContainerView),
  });

  // Actions — invalidate container list on settle
  const actionMutation = useMutation({
    mutationFn: ({ name, action }: { name: string; action: "start" | "stop" | "restart" }) =>
      containerAction(name, action),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["container-list", composePath] });
    },
  });

  const performAction = useCallback(
    (name: string, action: "start" | "stop" | "restart") =>
      actionMutation.mutateAsync({ name, action }),
    [actionMutation.mutateAsync],
  );

  // Log streaming — external subscription lifecycle (valid useEffect usage)
  const storeRef = useRef(store);
  storeRef.current = store;

  useEffect(() => {
    if (!selectedService) return;
    if (runtime.kind !== "ready") return;

    storeRef.current.clearContainerLogs(selectedService);
    streamLogs(
      selectedService,
      (line) => storeRef.current.appendContainerLog(selectedService, line),
      () => {},
    );
  }, [selectedService, runtime.kind]);

  return {
    runtime,
    containers: containerQuery.data ?? [],
    performAction,
  };
}
