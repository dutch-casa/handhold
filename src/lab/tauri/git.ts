import { invoke } from "@tauri-apps/api/core";

export type LineChange = {
  readonly line: number;
  readonly kind: "added" | "modified" | "deleted";
};

export async function getLineDiff(path: string): Promise<readonly LineChange[]> {
  return invoke<LineChange[]>("git_line_diff_head", { path });
}
