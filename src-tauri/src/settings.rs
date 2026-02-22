use serde::{Deserialize, Serialize};
use std::fs;

// Mirrors AppSettings from the frontend.
// Every field uses #[serde(default)] so old settings files parse without error on upgrade.

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub editor: EditorSettings,
    #[serde(default = "default_sidebar_panel")]
    pub sidebar_panel: String,
    #[serde(default)]
    pub sidebar_collapsed: bool,
    #[serde(default)]
    pub suppress_close_confirm: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSettings {
    #[serde(default)]
    pub vim_mode: bool,
    #[serde(default = "default_true")]
    pub ligatures: bool,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default = "default_tab_size")]
    pub tab_size: u32,
    #[serde(default = "default_true")]
    pub word_wrap: bool,
    #[serde(default = "default_line_numbers")]
    pub line_numbers: String,
    #[serde(default = "default_true")]
    pub bracket_colors: bool,
    #[serde(default)]
    pub auto_save: bool,
    #[serde(default = "default_auto_save_delay")]
    pub auto_save_delay: u32,
}

fn default_true() -> bool {
    true
}

fn default_font_size() -> u32 {
    14
}

fn default_tab_size() -> u32 {
    2
}

fn default_line_numbers() -> String {
    "on".to_string()
}

fn default_auto_save_delay() -> u32 {
    1000
}

fn default_sidebar_panel() -> String {
    "explorer".to_string()
}

impl Default for EditorSettings {
    fn default() -> Self {
        Self {
            vim_mode: false,
            ligatures: default_true(),
            font_size: default_font_size(),
            tab_size: default_tab_size(),
            word_wrap: default_true(),
            line_numbers: default_line_numbers(),
            bracket_colors: default_true(),
            auto_save: false,
            auto_save_delay: default_auto_save_delay(),
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            editor: EditorSettings::default(),
            sidebar_panel: default_sidebar_panel(),
            sidebar_collapsed: false,
            suppress_close_confirm: false,
        }
    }
}

#[tauri::command]
pub async fn load_settings() -> Result<AppSettings, String> {
    let path = crate::paths::settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("Failed to read settings: {e}"))?;
    serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {e}"))
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = crate::paths::settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create settings dir: {e}"))?;
    }

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;
    fs::write(&path, content).map_err(|e| format!("Failed to write settings: {e}"))
}
