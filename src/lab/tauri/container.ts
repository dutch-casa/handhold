import { invoke, Channel } from "@tauri-apps/api/core";
import type { ContainerRuntime } from "@/types/lab";

// Container orchestration — Podman-first, Docker fallback.
// Runtime detection cached server-side per app session.

export type ServiceEvent =
  | { readonly event: "serviceStarting"; readonly name: string }
  | { readonly event: "serviceHealthy"; readonly name: string }
  | {
      readonly event: "serviceFailed";
      readonly name: string;
      readonly error: string;
    }
  | { readonly event: "allHealthy" }
  | { readonly event: "error"; readonly message: string };

// Matches Rust ContainerInfo struct
export type ContainerInfo = {
  readonly id: string;
  readonly name: string;
  readonly image: string;
  readonly status: string;
  readonly health: string;
  readonly ports: string;
};

type LogEvent =
  | { readonly event: "line"; readonly data: string }
  | { readonly event: "end" }
  | { readonly event: "error"; readonly message: string };

export async function detect(): Promise<ContainerRuntime> {
  return invoke<ContainerRuntime>("detect_container_runtime");
}

export async function composeUp(
  composePath: string,
  onEvent: (e: ServiceEvent) => void,
): Promise<void> {
  const channel = new Channel<ServiceEvent>();
  channel.onmessage = onEvent;
  return invoke("compose_up", { composePath, onEvent: channel });
}

export async function composeDown(
  composePath: string,
  removeVolumes: boolean,
): Promise<void> {
  return invoke("compose_down", { composePath, removeVolumes });
}

export async function listContainers(
  composePath: string,
): Promise<readonly ContainerInfo[]> {
  return invoke<ContainerInfo[]>("container_list", { composePath });
}

export async function streamLogs(
  containerName: string,
  onLine: (line: string) => void,
  onEnd: () => void,
): Promise<void> {
  const channel = new Channel<LogEvent>();
  channel.onmessage = (event) => {
    switch (event.event) {
      case "line":
        onLine(event.data);
        break;
      case "end":
        onEnd();
        break;
      case "error":
        onEnd();
        break;
    }
  };
  return invoke("container_logs", { containerName, onLog: channel });
}

export async function containerAction(
  containerName: string,
  action: "start" | "stop" | "restart",
): Promise<void> {
  return invoke("container_action", { containerName, action });
}
