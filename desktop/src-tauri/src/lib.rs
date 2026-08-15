mod app;
mod config;
mod keymap;
mod keyboard;
mod mouse;
mod realtime;
mod session;
mod types;

use tauri::{
    image::Image, menu::{MenuBuilder, MenuItemBuilder}, tray::{TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

use crate::app::AppState;
use crate::config::Config;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::new(Config::load()))
        .setup(|app| {
            eprintln!("[airtype] app starting");
            setup_tray(app.handle())?;
            eprintln!("[airtype] tray ready");
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            app::init_app,
            app::new_session,
            app::toggle_pause,
            app::get_session_info,
            app::get_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItemBuilder::with_id("show", "Tampilkan AirType").build(app)?;
    let pause = MenuItemBuilder::with_id("pause", "Pause/Resume").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Keluar").build(app)?;

    let menu = MenuBuilder::new(app).items(&[&show, &pause, &quit]).build()?;

    TrayIconBuilder::with_id("airtype-tray")
        .icon(Image::from_bytes(include_bytes!("../icons/32x32.png"))?)
        .tooltip("AirType Helper")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "pause" => {
                let _ = app::toggle_pause(app.clone());
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { .. } = event {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
