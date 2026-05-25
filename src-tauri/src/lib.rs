use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, Runtime,
};

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

fn tray_icon() -> tauri::image::Image<'static> {
    let bytes = include_bytes!("../icons/tray-32.png");
    let decoded = image::load_from_memory(bytes).unwrap().into_rgba8();
    let (w, h) = decoded.dimensions();
    tauri::image::Image::new_owned(decoded.into_raw(), w, h)
}

fn window_icon() -> tauri::image::Image<'static> {
    let bytes = include_bytes!("../icons/icon.ico");
    let decoded = image::load_from_memory(bytes).unwrap().into_rgba8();
    let (w, h) = decoded.dimensions();
    tauri::image::Image::new_owned(decoded.into_raw(), w, h)
}

#[cfg(target_os = "windows")]
fn apply_window_composition(hwnd: isize) {
    #[link(name = "user32")]
    extern "system" {
        fn GetWindowLongW(hwnd: isize, n_index: i32) -> i32;
        fn SetWindowLongW(hwnd: isize, n_index: i32, dw_new_long: i32) -> i32;
        fn SetWindowPos(
            hwnd: isize, hwnd_insert_after: isize,
            x: i32, y: i32, cx: i32, cy: i32, u_flags: u32,
        ) -> i32;
    }
    #[link(name = "dwmapi")]
    extern "system" {
        fn DwmSetWindowAttribute(
            hwnd: isize, dw_attribute: u32,
            pv_attribute: *const i32, cb_attribute: u32,
        ) -> i32;
    }
    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_NOREDIRECTIONBITMAP: i32 = 0x00200000;
    const SWP_FLAGS: u32 = 0x0001 | 0x0002 | 0x0004 | 0x0020;
    const DWMWA_TRANSITIONS_FORCEDISABLED: u32 = 3;
    const DWMWA_DISALLOW_PEEK: u32 = 11;
    const DWMWA_EXCLUDED_FROM_PEEK: u32 = 12;
    const DWMWA_SYSTEMBACKDROP_TYPE: u32 = 38;
    unsafe {
        let ex = GetWindowLongW(hwnd, GWL_EXSTYLE);
        SetWindowLongW(hwnd, GWL_EXSTYLE, ex | WS_EX_NOREDIRECTIONBITMAP);
        SetWindowPos(hwnd, 0, 0, 0, 0, 0, SWP_FLAGS);
        let one: i32 = 1;
        let zero: i32 = 0;
        DwmSetWindowAttribute(hwnd, DWMWA_TRANSITIONS_FORCEDISABLED, &one, 4);
        DwmSetWindowAttribute(hwnd, DWMWA_DISALLOW_PEEK, &one, 4);
        DwmSetWindowAttribute(hwnd, DWMWA_EXCLUDED_FROM_PEEK, &one, 4);
        DwmSetWindowAttribute(hwnd, DWMWA_SYSTEMBACKDROP_TYPE, &zero, 4);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            start_alt_monitor(app.handle().clone());

            #[cfg(target_os = "windows")]
            if let Some(win) = app.get_webview_window("main") {
                if let Ok(hwnd) = win.hwnd() {
                    apply_window_composition(hwnd.0 as isize);
                }
            }

            let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit     = MenuItem::with_id(app, "quit",     "Quit penciless", true, None::<&str>)?;
            let menu     = Menu::with_items(app, &[&settings, &quit])?;

            TrayIconBuilder::with_id("main")
                .menu(&menu)
                .menu_on_left_click(false)
                .icon(tray_icon())
                .tooltip("penciless")
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(win) = tray.app_handle().get_webview_window("main") {
                            let _ = win.set_focus();
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
                                    let _ = win.set_icon(window_icon());
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
