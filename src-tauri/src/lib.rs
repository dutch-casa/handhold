mod container;
mod course;
mod db;
mod fs;
mod git;
mod lsp;
mod preview;
mod pty;
mod runner;
mod search;
mod settings;
mod tts;
mod watcher;

use tauri::menu::{AboutMetadata, Menu, PredefinedMenuItem, Submenu};
use tauri::Manager;

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let about_meta = AboutMetadata {
        name: Some("Handhold".into()),
        version: Some("0.0.1".into()),
        copyright: Some("\u{00a9} 2026 Dutch Casadaban. All rights reserved.".into()),
        credits: Some("Built by Dutch Casadaban".into()),
        ..Default::default()
    };

    let app_menu = Submenu::with_items(
        app,
        "Handhold",
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(about_meta))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::show_all(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        app,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(app, None)?,
            &PredefinedMenuItem::redo(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, None)?,
            &PredefinedMenuItem::copy(app, None)?,
            &PredefinedMenuItem::paste(app, None)?,
            &PredefinedMenuItem::select_all(app, None)?,
        ],
    )?;

    let view_menu = Submenu::with_items(
        app,
        "View",
        true,
        &[&PredefinedMenuItem::fullscreen(app, None)?],
    )?;

    let window_menu = Submenu::with_items(
        app,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu, &edit_menu, &view_menu, &window_menu])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let database = db::init().expect("Failed to initialize database");
    let active_composes = container::ActiveComposes::new();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .manage(database)
        .manage(active_composes)
        .invoke_handler(tauri::generate_handler![
            tts::synthesize,
            tts::export_audio,
            // File system
            fs::read_file,
            fs::write_file,
            fs::create_file,
            fs::create_dir,
            fs::delete_path,
            fs::rename_path,
            fs::move_path,
            fs::path_exists,
            fs::wipe_dir,
            fs::copy_scaffold,
            fs::read_dir_recursive,
            fs::read_ts_project_files,
            fs::read_type_definitions,
            // LSP language servers
            lsp::lsp_spawn,
            lsp::lsp_send,
            lsp::lsp_kill,
            // PTY terminal
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            // Command execution
            runner::run_command,
            // Settings persistence
            settings::load_settings,
            settings::save_settings,
            // File watcher
            watcher::watch_dir,
            watcher::unwatch_dir,
            // Git
            git::git_line_diff,
            git::git_line_diff_head,
            // Container orchestration
            container::detect_container_runtime,
            container::compose_up,
            container::compose_down,
            container::container_list,
            container::container_logs,
            container::container_action,
            // Course browser
            course::course_import,
            course::course_list,
            course::course_search,
            course::course_tags,
            course::course_by_tag,
            course::course_delete,
            course::step_complete,
            course::step_progress,
            course::route_save,
            course::route_load,
            course::course_get,
            course::course_manifest,
            course::course_read_step,
            course::course_read_lab,
            course::slide_position_save,
            course::slide_position_load,
            // Workspace search
            search::search_workspace,
            // Preview compilation
            preview::compile_jsx,
            // Lab provision tracking
            course::lab_is_provisioned,
            course::lab_mark_provisioned,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            handle.state::<container::ActiveComposes>().teardown_all();
        }
    });
}
