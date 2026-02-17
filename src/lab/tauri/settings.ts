import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "@/types/settings";

// Settings persistence — ~/.handhold/settings.json

export async function load(): Promise<AppSettings> {
  return invoke<AppSettings>("load_settings");
}

export async function save(settings: AppSettings): Promise<void> {
  return invoke("save_settings", { settings });
}
