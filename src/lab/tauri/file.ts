import { invoke } from "@tauri-apps/api/core";

// File CRUD — deep module hiding Tauri IPC

export async function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export async function writeFile(
  path: string,
  content: string,
): Promise<void> {
  return invoke("write_file", { path, content });
}

export async function createFile(path: string): Promise<void> {
  return invoke("create_file", { path });
}

export async function createDir(path: string): Promise<void> {
  return invoke("create_dir", { path });
}

export async function removePath(path: string): Promise<void> {
  return invoke("delete_path", { path });
}

export async function renamePath(
  from: string,
  to: string,
): Promise<void> {
  return invoke("rename_path", { from, to });
}

export async function movePath(from: string, to: string): Promise<void> {
  return invoke("move_path", { from, to });
}
