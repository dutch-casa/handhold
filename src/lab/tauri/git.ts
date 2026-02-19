import { invoke } from "@tauri-apps/api/core";

export type LineChange = {
  readonly line: number;
  readonly kind: "added" | "modified" | "deleted";
};

export async function getLineDiff(path: string, workspace: string): Promise<readonly LineChange[]> {
  return invoke<LineChange[]>("git_line_diff_head", { path, workspace });
}

export type GitFileStatus = "modified" | "added" | "deleted" | "untracked" | "renamed";

export type GitStatusEntry = {
  readonly path: string;
  readonly status: GitFileStatus;
};

export async function getGitStatus(workspace: string): Promise<readonly GitStatusEntry[]> {
  return invoke<GitStatusEntry[]>("git_status_files", { workspace });
}
