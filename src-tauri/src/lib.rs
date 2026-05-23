use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Runtime,
};
use tauri_plugin_global_shortcut::ShortcutState;

#[tauri::command]
fn set_passthrough<R: Runtime>(window: tauri::Window<R>, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

#[cfg(target_os = "windows")]
fn is_alt_shift_held() -> bool {
    #[link(name = "user32")]
    extern "system" {
        fn GetAsyncKeyState(nVirtKey: i32) -> i16;
    }
    unsafe {
        let alt   = (GetAsyncKeyState(0x12) as u16) & 0x8000 != 0;
        let shift = (GetAsyncKeyState(0x10) as u16) & 0x8000 != 0;
        alt && shift
    }
}

fn start_alt_monitor(app_handle: tauri::AppHandle) {
    std::thread::spawn(move || {
        let mut was_held = false;
        let mut passthrough = false;
        loop {
            #[cfg(target_os = "windows")]
            let held = is_alt_shift_held();
            #[cfg(not(target_os = "windows"))]
            let held = false;

            if held && !was_held {
                passthrough = !passthrough;
                if let Some(win) = app_handle.get_webview_window("main") {
                    let _ = win.set_ignore_cursor_events(passthrough);
                    let _ = win.emit("alt-state", passthrough);
                }
            }
            was_held = held;
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
    });
}

fn mono_icon() -> tauri::image::Image<'static> {
    let bytes = include_bytes!("../icons/tray-32.png");
    let decoded = image::load_from_memory(bytes).unwrap().into_rgba8();
    let (w, h) = decoded.dimensions();
    tauri::image::Image::new_owned(decoded.into_raw(), w, h)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut("Alt+A")
                .expect("invalid shortcut")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.emit("toggle-annotating", ());
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            start_alt_monitor(app.handle().clone());

            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit     = MenuItem::with_id(app, "quit",     "Quit penciless", true, None::<&str>)?;
            let menu     = Menu::with_items(app, &[&settings, &quit])?;

            TrayIconBuilder::with_id("main")
                .menu(&menu)
                .icon(mono_icon())
                .tooltip("penciless")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.emit("toggle-annotating", ());
                        }
                    }
                })
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "settings" => {
                            if let Some(win) = app.get_webview_window("settings") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            } else {
                                if let Ok(win) = tauri::WebviewWindowBuilder::new(
                                    app,
                                    "settings",
                                    tauri::WebviewUrl::App("settings.html".into()),
                                )
                                .title("penciless — Settings")
                                .inner_size(460.0, 600.0)
                                .resizable(false)
                                .center()
                                .build()
                                {
                                    let _ = win.set_icon(mono_icon());
                                }
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![set_passthrough, open_url])
        .run(tauri::generate_context!())
        .expect("error while running penciless");
}
