import { invoke, Channel } from "@tauri-apps/api/core";
import type { FsEntry } from "@/types/lab";

// Workspace operations — scaffold, tree reading, file watching

type WatchEvent =
  | { readonly event: "created"; readonly path: string }
  | { readonly event: "modified"; readonly path: string }
  | { readonly event: "deleted"; readonly path: string }
  | { readonly event: "renamed"; readonly from: string; readonly to: string };

type Disposable = { dispose: () => void };

export async function pathExists(path: string): Promise<boolean> {
  return invoke<boolean>("path_exists", { path });
}

export async function wipeDir(path: string): Promise<void> {
  return invoke("wipe_dir", { path });
}

export async function scaffold(
  labPath: string,
  workspacePath: string,
): Promise<void> {
  return invoke("copy_scaffold", {
    sourceDir: labPath,
    targetDir: workspacePath,
  });
}

export async function readTree(
  path: string,
): Promise<readonly FsEntry[]> {
  return invoke<FsEntry[]>("read_dir_recursive", { path });
}

export async function isProvisioned(workspacePath: string): Promise<boolean> {
  return invoke<boolean>("lab_is_provisioned", { workspacePath });
}

export async function markProvisioned(workspacePath: string): Promise<void> {
  return invoke("lab_mark_provisioned", { workspacePath });
}

export async function watch(
  path: string,
  onChange: () => void,
): Promise<Disposable> {
  const onEvent = new Channel<WatchEvent>();
  onEvent.onmessage = () => onChange();

  const watcherId = await invoke<number>("watch_dir", {
    path,
    onEvent,
  });

  return {
    dispose: () => {
      invoke("unwatch_dir", { watcherId }).catch(() => {
        // Best-effort cleanup
      });
    },
  };
}
