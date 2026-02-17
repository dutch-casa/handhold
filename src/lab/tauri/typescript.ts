import { invoke } from "@tauri-apps/api/core";

export type FileContent = { readonly path: string; readonly content: string };

export function readTsProjectFiles(root: string): Promise<readonly FileContent[]> {
  return invoke<FileContent[]>("read_ts_project_files", { root });
}

export function readTypeDefinitions(root: string): Promise<readonly FileContent[]> {
  return invoke<FileContent[]>("read_type_definitions", { root });
}
