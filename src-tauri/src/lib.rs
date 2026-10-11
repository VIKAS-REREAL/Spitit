//! REREAL Spitit v3: Tauri Application Core & IPC Handlers.
//! Decoupled architecture with single source of truth, thread-safe audio streaming,
//! SQLite persistent storage, honest error handling, and multi-monitor DPI scaling.

mod app_tracker;
mod credentials;
mod db;
mod hotkey;
mod paster;
mod recorder;
mod settings;
mod transcriber;

use app_tracker::{AppInfo, AppTracker};
use db::{DashboardStats, DbManager, HistoryRecord};
use hotkey::{ActivationMode, EngineState, HotkeyEvent, HotkeyManager, ValidationResult};
use recorder::{list_input_devices, AudioDeviceInfo, AudioRecorder};
use serde::Serialize;
use settings::UserSettings;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, Wry,
};
use windows::core::PCWSTR;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTOPRIMARY,
};
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_DWORD, REG_SZ,
};
use windows::Win32::UI::HiDpi::GetDpiForWindow;
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, GetSystemMetrics, GetWindowLongW, SetForegroundWindow,
    SetWindowLongW, SetWindowPos, ShowWindow, GWL_EXSTYLE, GWL_STYLE, HWND_TOPMOST,
    SM_CXSCREEN, SM_CYSCREEN, SWP_FRAMECHANGED, SWP_HIDEWINDOW, SWP_NOACTIVATE, SWP_NOMOVE,
    SWP_NOSIZE, SW_RESTORE, SW_SHOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_MAXIMIZEBOX,
    WS_THICKFRAME,
};

#[derive(Serialize, Clone)]
pub struct TranscriptMeta {
    pub text: String,
    pub word_count: usize,
    pub duration_secs: f32,
    pub wpm: u32,
    pub app_name: String,
    pub app_icon: Option<String>,
}

struct AppState {
    recorder: Arc<AudioRecorder>,
    hotkey_mgr: Arc<HotkeyManager>,
    language: Mutex<String>,
    _app_tracker: Arc<AppTracker>,
    api_key: Mutex<String>,
    settings: Mutex<UserSettings>,
    db: Arc<DbManager>,
    tray_lang_items: Mutex<Option<(CheckMenuItem<Wry>, CheckMenuItem<Wry>)>>,
    captured_app: Mutex<Option<AppInfo>>,
}

pub fn bring_main_window_to_front(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if let Ok(true) = win.is_maximized() {
            let _ = win.unmaximize();
        }
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.center();
        if let Ok(hwnd_val) = win.hwnd() {
            unsafe {
                let hwnd = HWND(hwnd_val.0 as _);
                let _ = ShowWindow(hwnd, SW_RESTORE);
                let _ = ShowWindow(hwnd, SW_SHOW);
                let _ = SetForegroundWindow(hwnd);
                let _ = BringWindowToTop(hwnd);
            }
        }
    } else {
        // Created on demand per spec section 3 & rule 8 to minimize idle RAM
        if let Ok(win) = tauri::WebviewWindowBuilder::new(
            app,
            "main",
            tauri::WebviewUrl::App("index.html".into()),
        )
        .title("Spitit")
        .inner_size(880.0, 600.0)
        .min_inner_size(720.0, 520.0)
        .center()
        .decorations(false)
        .transparent(false)
        .build()
        {
            if let Some(icon) = app.default_window_icon() {
                let _ = win.set_icon(icon.clone());
            }
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

pub fn configure_pill_window(pill_win: &tauri::WebviewWindow) {
    if let Ok(raw_hwnd) = pill_win.hwnd() {
        let hwnd = HWND(raw_hwnd.0 as _);
        unsafe {
            // 1. Strip WS_MAXIMIZEBOX and WS_THICKFRAME to prevent maximizing on double-click
            let style = GetWindowLongW(hwnd, GWL_STYLE);
            SetWindowLongW(
                hwnd,
                GWL_STYLE,
                style & !(WS_MAXIMIZEBOX.0 as i32) & !(WS_THICKFRAME.0 as i32),
            );

            // 2. Set WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW so pill never steals focus
            let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
            SetWindowLongW(
                hwnd,
                GWL_EXSTYLE,
                ex_style
                    | (WS_EX_NOACTIVATE.0 as i32)
                    | (WS_EX_TOOLWINDOW.0 as i32),
            );

            let _ = SetWindowPos(
                hwnd,
                HWND_TOPMOST,
                0,
                0,
                0,
                0,
                SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED,
            );

            // 3. Position pill on active monitor with proper DPI scaling
            position_pill_on_monitor(hwnd);
        }
    }
}

pub unsafe fn position_pill_on_monitor(hwnd: HWND) {
    let hmon = MonitorFromWindow(hwnd, MONITOR_DEFAULTTOPRIMARY);
    let mut mi = MONITORINFO {
        cbSize: std::mem::size_of::<MONITORINFO>() as u32,
        ..Default::default()
    };

    let (screen_w, screen_h, base_x, base_y) = if GetMonitorInfoW(hmon, &mut mi).as_bool() {
        (
            mi.rcWork.right - mi.rcWork.left,
            mi.rcWork.bottom - mi.rcWork.top,
            mi.rcWork.left,
            mi.rcWork.top,
        )
    } else {
        (
            GetSystemMetrics(SM_CXSCREEN),
            GetSystemMetrics(SM_CYSCREEN),
            0,
            0,
        )
    };

    let dpi = GetDpiForWindow(hwnd);
    let scale = if dpi > 0 { dpi as f32 / 96.0 } else { 1.0 };

    let pill_w = (160.0 * scale) as i32;
    let pill_h = (38.0 * scale) as i32;
    let x = base_x + (screen_w - pill_w) / 2;
    let y = base_y + screen_h - pill_h - (24.0 * scale) as i32;

    let _ = SetWindowPos(
        hwnd,
        HWND_TOPMOST,
        x,
        y,
        pill_w,
        pill_h,
        SWP_NOACTIVATE | SWP_HIDEWINDOW,
    );
}

#[tauri::command]
fn minimize_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.minimize();
    }
}

#[tauri::command]
fn toggle_maximize_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if let Ok(is_max) = win.is_maximized() {
            if is_max {
                let _ = win.unmaximize();
            } else {
                let _ = win.maximize();
            }
        }
    }
}

#[tauri::command]
fn close_window(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

#[tauri::command]
fn reset_pill_position(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(pill_win) = app.get_webview_window("pill") {
        if let Ok(raw_hwnd) = pill_win.hwnd() {
            unsafe {
                position_pill_on_monitor(HWND(raw_hwnd.0 as _));
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn get_api_key(state: tauri::State<AppState>) -> Result<String, String> {
    let mem = state.api_key.lock().unwrap().clone();
    if !mem.is_empty() {
        return Ok(mem);
    }
    let k = credentials::get_api_key()?;
    if !k.is_empty() {
        *state.api_key.lock().unwrap() = k.clone();
    }
    Ok(k)
}

#[tauri::command]
fn save_api_key(state: tauri::State<AppState>, api_key: String) -> Result<(), String> {
    let trimmed = api_key.trim().to_string();
    *state.api_key.lock().unwrap() = trimmed.clone();
    credentials::save_api_key(&trimmed)
}

#[tauri::command]
async fn test_api_key(api_key: String) -> Result<String, String> {
    transcriber::test_connection(&api_key).await
}

#[tauri::command]
fn get_all_settings(state: tauri::State<AppState>) -> UserSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_all_settings(
    state: tauri::State<AppState>,
    app: tauri::AppHandle,
    new_settings: UserSettings,
) -> Result<(), String> {
    let mode = match new_settings.mode.to_lowercase().as_str() {
        "toggle" => ActivationMode::Toggle,
        _ => ActivationMode::Hold,
    };
    state.hotkey_mgr.set_mode(mode);
    state.hotkey_mgr.update_combos(
        &new_settings.hold_hotkey,
        &new_settings.toggle_hotkey,
        new_settings.minimum_hold_time_ms,
    );

    *state.language.lock().unwrap() = new_settings.language.clone();
    *state.settings.lock().unwrap() = new_settings.clone();

    let _ = app.emit("settings_updated", &new_settings);
    let _ = app.emit("language_changed", &new_settings.language);
    let tray_items = state.tray_lang_items.lock().unwrap().clone();
    if let Some((en_item, hi_item)) = tray_items {
        let is_en = new_settings.language != "hinglish";
        let _ = en_item.set_checked(is_en);
        let _ = hi_item.set_checked(!is_en);
    }
    settings::save_settings(&new_settings)
}

#[tauri::command]
fn validate_hotkey(combo: String, is_hold: bool, other_combo: String) -> ValidationResult {
    hotkey::validate_hotkey_combo(&combo, is_hold, &other_combo)
}

#[tauri::command]
fn list_mics() -> Vec<AudioDeviceInfo> {
    list_input_devices()
}

#[tauri::command]
fn is_clipboard_history_enabled() -> bool {
    unsafe {
        let subkey: Vec<u16> = "Software\\Microsoft\\Clipboard\0".encode_utf16().collect();
        let name: Vec<u16> = "EnableClipboardHistory\0".encode_utf16().collect();
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        )
        .is_ok()
        {
            let mut val_type = REG_DWORD;
            let mut val: u32 = 0;
            let mut val_len = 4u32;
            let res = RegQueryValueExW(
                hkey,
                PCWSTR(name.as_ptr()),
                None,
                Some(&mut val_type),
                Some(&mut val as *mut _ as *mut u8),
                Some(&mut val_len),
            );
            let _ = RegCloseKey(hkey);
            res.is_ok() && val == 1
        } else {
            false
        }
    }
}

#[tauri::command]
fn open_windows_settings(uri: String) -> Result<(), String> {
    unsafe {
        let wide: Vec<u16> = uri.encode_utf16().chain(std::iter::once(0)).collect();
        let open_verb: Vec<u16> = "open\0".encode_utf16().collect();
        let res = ShellExecuteW(
            HWND(std::ptr::null_mut()),
            PCWSTR(open_verb.as_ptr()),
            PCWSTR(wide.as_ptr()),
            PCWSTR(std::ptr::null()),
            PCWSTR(std::ptr::null()),
            SW_SHOW,
        );
        if res.0 as usize > 32 {
            Ok(())
        } else {
            Err("Failed to open Windows Settings page".into())
        }
    }
}

#[tauri::command]
fn is_autostart_enabled() -> bool {
    unsafe {
        let subkey: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Run\0"
            .encode_utf16()
            .collect();
        let name: Vec<u16> = "Spitit\0".encode_utf16().collect();
        let mut hkey = windows::Win32::System::Registry::HKEY::default();
        if RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            0,
            KEY_READ,
            &mut hkey,
        )
        .is_ok()
        {
            let res = RegQueryValueExW(
                hkey,
                PCWSTR(name.as_ptr()),
                None,
                None,
                None,
                None,
            );
            let _ = RegCloseKey(hkey);
            res.is_ok()
        } else {
            false
        }
    }
}

#[tauri::command]
fn set_autostart_enabled(enabled: bool) -> Result<(), String> {
    unsafe {
        let subkey: Vec<u16> = "Software\\Microsoft\\Windows\\CurrentVersion\\Run\0"
            .encode_utf16()
            .collect();
        let name: Vec<u16> = "Spitit\0".encode_utf16().collect();
        let mut hkey = windows::Win32::System::Registry::HKEY::default();

        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            PCWSTR(subkey.as_ptr()),
            0,
            KEY_WRITE,
            &mut hkey,
        )
        .ok()
        .map_err(|e| format!("RegOpenKeyExW failed: {e}"))?;

        let res = if enabled {
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            // Pass --autostart flag so launch starts silently in system tray without splash
            let val = format!("\"{}\" --autostart", current_exe.to_string_lossy());
            let val_w: Vec<u16> = val.encode_utf16().chain(std::iter::once(0)).collect();
            let bytes = std::slice::from_raw_parts(val_w.as_ptr() as *const u8, val_w.len() * 2);
            RegSetValueExW(
                hkey,
                PCWSTR(name.as_ptr()),
                0,
                REG_SZ,
                Some(bytes),
            )
        } else {
            RegDeleteValueW(hkey, PCWSTR(name.as_ptr()))
        };
        let _ = RegCloseKey(hkey);
        res.ok().map_err(|e| format!("Registry write failed: {e}"))
    }
}

// Database IPC commands
#[tauri::command]
fn get_history(state: tauri::State<AppState>, search: Option<String>, limit: Option<usize>) -> Result<Vec<HistoryRecord>, String> {
    state.db.get_history(search.as_deref(), limit.unwrap_or(100))
}

#[tauri::command]
fn delete_history_item(state: tauri::State<AppState>, id: i64) -> Result<(), String> {
    state.db.delete_history_item(id)
}

#[tauri::command]
fn clear_history(state: tauri::State<AppState>) -> Result<(), String> {
    state.db.clear_history()
}

#[tauri::command]
fn get_dashboard_stats(state: tauri::State<AppState>) -> Result<DashboardStats, String> {
    state.db.get_dashboard_stats()
}

#[tauri::command]
fn reset_stats(state: tauri::State<AppState>) -> Result<(), String> {
    state.db.reset_stats()
}

#[tauri::command]
fn hide_pill_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("pill") {
        let _ = win.hide();
    }
    Ok(())
}

#[tauri::command]
fn cancel_recording(state: tauri::State<AppState>, app: tauri::AppHandle) -> Result<(), String> {
    state.recorder.cancel();
    state.hotkey_mgr.set_engine_state(EngineState::Idle);
    let _ = app.emit("recording_state", "cancelled");
    hide_pill_window(app)
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    bring_main_window_to_front(&app);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let args: Vec<String> = std::env::args().collect();
    let is_autostart_launch = args.iter().any(|a| a == "--autostart");

    let initial_settings = settings::load_settings();

    let initial_mode = match initial_settings.mode.as_str() {
        "toggle" => ActivationMode::Toggle,
        _ => ActivationMode::Hold,
    };

    let (hotkey_mgr, rx) = HotkeyManager::new(
        initial_mode,
        &initial_settings.hold_hotkey,
        &initial_settings.toggle_hotkey,
        initial_settings.minimum_hold_time_ms,
    );
    let hotkey_mgr = Arc::new(hotkey_mgr);
    hotkey_mgr.start();

    let tracker = Arc::new(AppTracker::new());
    let init_key = credentials::get_api_key().unwrap_or_default();
    let db = Arc::new(DbManager::init().expect("Failed to initialize SQLite database"));

    // Audio callbacks
    let app_handle_for_audio: Arc<Mutex<Option<tauri::AppHandle>>> = Arc::new(Mutex::new(None));

    let handle_level = Arc::clone(&app_handle_for_audio);
    let on_level = move |level: f32| {
        if let Ok(lock) = handle_level.try_lock() {
            if let Some(handle) = lock.as_ref() {
                let _ = handle.emit("mic_level", level);
            }
        }
    };

    let handle_countdown = Arc::clone(&app_handle_for_audio);
    let on_countdown = move |remaining: u32| {
        if let Ok(lock) = handle_countdown.try_lock() {
            if let Some(handle) = lock.as_ref() {
                let _ = handle.emit("countdown_remaining", remaining);
            }
        }
    };

    let handle_autostop = Arc::clone(&app_handle_for_audio);
    let hotkey_mgr_autostop = Arc::clone(&hotkey_mgr);
    let on_autostop = move || {
        hotkey_mgr_autostop.set_engine_state(EngineState::Processing);
        if let Ok(lock) = handle_autostop.try_lock() {
            if let Some(handle) = lock.as_ref() {
                let _ = handle.emit("max_duration_reached", ());
                let _ = handle.emit("recording_state", "processing");
            }
        }
    };

    let recorder = Arc::new(AudioRecorder::new(on_level, on_countdown, on_autostop));

    let app_state = AppState {
        recorder: Arc::clone(&recorder),
        hotkey_mgr: Arc::clone(&hotkey_mgr),
        language: Mutex::new(initial_settings.language.clone()),
        _app_tracker: Arc::clone(&tracker),
        api_key: Mutex::new(init_key.clone()),
        settings: Mutex::new(initial_settings.clone()),
        db: Arc::clone(&db),
        tray_lang_items: Mutex::new(None),
        captured_app: Mutex::new(None),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Second launch brings existing window to front
            bring_main_window_to_front(app);
        }))
        .manage(app_state)
        .setup(move |app| {
            let handle = app.handle().clone();
            *app_handle_for_audio.lock().unwrap() = Some(handle.clone());

            // Set explicit taskbar and window icon
            if let Some(main_win) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = main_win.set_icon(icon.clone());
                }
            }

            // Show main window ONLY if:
            // 1. Not launching silently via Windows startup (--autostart)
            // 2. AND (API key is not configured OR onboarding is not completed)
            if !is_autostart_launch && (init_key.is_empty() || !initial_settings.onboarding_completed) {
                bring_main_window_to_front(&handle);
            }

            // Setup System Tray
            let open_i = MenuItem::with_id(&handle, "open", "Open Spitit", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(&handle)?;
            let is_en = initial_settings.language != "hinglish";
            let is_hi = initial_settings.language == "hinglish";
            let lang_en_i = CheckMenuItem::with_id(
                &handle,
                "lang_en",
                "English (Fast)",
                true,
                is_en,
                None::<&str>,
            )?;
            let lang_hinglish_i = CheckMenuItem::with_id(
                &handle,
                "lang_hinglish",
                "Hinglish (AI Enhanced)",
                true,
                is_hi,
                None::<&str>,
            )?;
            let sep2 = PredefinedMenuItem::separator(&handle)?;
            let quit_i = MenuItem::with_id(&handle, "quit", "Quit Spitit", true, None::<&str>)?;
            let menu = Menu::with_items(
                &handle,
                &[&open_i, &sep1, &lang_en_i, &lang_hinglish_i, &sep2, &quit_i],
            )?;

            *app.state::<AppState>().tray_lang_items.lock().unwrap() =
                Some((lang_en_i.clone(), lang_hinglish_i.clone()));

            let mut tray_b = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Spitit")
                .title("Spitit")
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon() {
                tray_b = tray_b.icon(icon.clone());
            }

            let _tray = tray_b
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => {
                        bring_main_window_to_front(app);
                    }
                    "lang_en" => {
                        let state = app.state::<AppState>();
                        *state.language.lock().unwrap() = "en".to_string();
                        let mut s = state.settings.lock().unwrap();
                        s.language = "en".to_string();
                        let _ = settings::save_settings(&s);
                        let _ = app.emit("language_changed", "en");
                        let tray_items = state.tray_lang_items.lock().unwrap().clone();
                        if let Some((en_item, hi_item)) = tray_items {
                            let _ = en_item.set_checked(true);
                            let _ = hi_item.set_checked(false);
                        }
                    }
                    "lang_hinglish" => {
                        let state = app.state::<AppState>();
                        *state.language.lock().unwrap() = "hinglish".to_string();
                        let mut s = state.settings.lock().unwrap();
                        s.language = "hinglish".to_string();
                        let _ = settings::save_settings(&s);
                        let _ = app.emit("language_changed", "hinglish");
                        let tray_items = state.tray_lang_items.lock().unwrap().clone();
                        if let Some((en_item, hi_item)) = tray_items {
                            let _ = en_item.set_checked(false);
                            let _ = hi_item.set_checked(true);
                        }
                    }
                    "quit" => {
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        ..
                    } = event
                    {
                        bring_main_window_to_front(tray.app_handle());
                    }
                })
                .build(app)?;

            // Start foreground active-app tracker
            app_tracker::start_tracking(handle.clone(), tracker.clone());

            // Configure Pill window
            if let Some(pill_win) = app.get_webview_window("pill") {
                configure_pill_window(&pill_win);
            }

            // Event-driven decoupled hotkey worker loop
            let handle_worker = handle.clone();
            let tracker_worker = tracker.clone();

            std::thread::spawn(move || {
                let rt = tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .unwrap();

                while let Ok(event) = rx.recv() {
                    let app_state = handle_worker.state::<AppState>();
                    match event {
                        HotkeyEvent::StartCandidate => {
                            // Section 4.5: Open microphone first before showing UI
                            let mic_device = {
                                let s = app_state.settings.lock().unwrap();
                                s.microphone_device.clone()
                            };
                            let dev_opt = if mic_device == "System default" || mic_device.is_empty() {
                                None
                            } else {
                                Some(mic_device)
                            };

                            let start_res = app_state.recorder.start(dev_opt);
                            if let Err(e) = start_res {
                                app_state.hotkey_mgr.set_engine_state(EngineState::Idle);
                                let _ = handle_worker.emit("recording_state", format!("error:{e}"));
                                if let Some(pill_win) = handle_worker.get_webview_window("pill") {
                                    let _ = pill_win.show();
                                }
                                continue;
                            }

                            // Capture the active application AT HOTKEY PRESS (Section 2.5)
                            let current_app = tracker_worker.get_current_app();
                            *app_state.captured_app.lock().unwrap() = Some(current_app.clone());
                            let _ = handle_worker.emit("foreground_app_changed", &current_app);
                        }

                        HotkeyEvent::StartConfirmed => {
                            // Past tap threshold: show pill and emit recording
                            if let Some(pill_win) = handle_worker.get_webview_window("pill") {
                                let _ = pill_win.show();
                            }
                            let _ = handle_worker.emit("recording_state", "recording");
                            let _ = handle_worker.emit("play_start_sound", ());
                        }

                        HotkeyEvent::TapIgnored => {
                            // Accidental short tap: cancel audio, no pill shown, no API call
                            app_state.recorder.cancel();
                            app_state.hotkey_mgr.set_engine_state(EngineState::Idle);
                        }

                        HotkeyEvent::Stop => {
                            let _ = handle_worker.emit("recording_state", "processing");

                            let wav_opt = match app_state.recorder.stop() {
                                Ok(opt) => opt,
                                Err(err) => {
                                    app_state.hotkey_mgr.set_engine_state(EngineState::Idle);
                                    let _ = handle_worker.emit("recording_state", format!("error:{err}"));
                                    continue;
                                }
                            };

                            let wav_bytes = match wav_opt {
                                Some(b) => b,
                                None => {
                                    // Too short or empty
                                    app_state.hotkey_mgr.set_engine_state(EngineState::Idle);
                                    let _ = handle_worker.emit("recording_state", "error:ERR_NO_SPEECH: Recording was too short. Hold and speak clearly.");
                                    continue;
                                }
                            };

                            let key = {
                                let k = app_state.api_key.lock().unwrap().clone();
                                if !k.is_empty() {
                                    k
                                } else {
                                    credentials::get_api_key().unwrap_or_default()
                                }
                            };

                            if key.is_empty() {
                                app_state.hotkey_mgr.set_engine_state(EngineState::Idle);
                                let _ = handle_worker.emit("recording_state", "error:ERR_NO_API_KEY: Please configure your Groq API key.");
                                continue;
                            }

                            let lang = app_state.language.lock().unwrap().clone();
                            let captured_app = app_state
                                .captured_app
                                .lock()
                                .unwrap()
                                .clone()
                                .unwrap_or_else(|| tracker_worker.get_current_app());

                            let settings_clone = app_state.settings.lock().unwrap().clone();
                            let handle_async = handle_worker.clone();
                            let db_async = Arc::clone(&app_state.db);
                            let hotkey_mgr_async = Arc::clone(&app_state.hotkey_mgr);
                            let duration = app_state.recorder.get_last_duration();

                            // Asynchronous transcription & paste task: hotkey event loop is NEVER blocked!
                            rt.spawn(async move {
                                match transcriber::transcribe(wav_bytes, &key, &lang).await {
                                    Ok(text) => {
                                        // 1. Paste into target window
                                        let paste_res = paster::paste_text(
                                            &text,
                                            captured_app.hwnd,
                                            settings_clone.auto_paste,
                                        );

                                        if let Err(e) = paste_res {
                                            let _ = handle_async.emit("recording_state", format!("error:{e}"));
                                        }

                                        let word_count = text.split_whitespace().count();
                                        let wpm = if duration >= 0.5 {
                                            ((word_count as f32 / duration) * 60.0).round() as u32
                                        } else {
                                            0
                                        };

                                        // 2. Save to SQLite database
                                        let _ = db_async.save_record(
                                            &text,
                                            word_count,
                                            duration,
                                            wpm,
                                            &captured_app.name,
                                            captured_app.icon_data_url.as_deref(),
                                            &lang,
                                            settings_clone.save_history,
                                            settings_clone.keep_stats,
                                        );

                                        let meta = TranscriptMeta {
                                            text: text.clone(),
                                            word_count,
                                            duration_secs: duration,
                                            wpm,
                                            app_name: captured_app.name,
                                            app_icon: captured_app.icon_data_url,
                                        };

                                        let _ = handle_async.emit("transcript_meta", &meta);
                                        let _ = handle_async.emit("transcript_done", &text);
                                        let _ = handle_async.emit("play_done_sound", ());
                                    }
                                    Err(e) => {
                                        let _ = handle_async.emit("recording_state", format!("error:{e}"));
                                    }
                                }
                                hotkey_mgr_async.set_engine_state(EngineState::Idle);
                            });
                        }

                        HotkeyEvent::Cancel => {
                            app_state.recorder.cancel();
                            app_state.hotkey_mgr.set_engine_state(EngineState::Idle);
                            let _ = handle_worker.emit("recording_state", "cancelled");
                            if let Some(pill_win) = handle_worker.get_webview_window("pill") {
                                let _ = pill_win.hide();
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            save_api_key,
            test_api_key,
            get_all_settings,
            save_all_settings,
            validate_hotkey,
            list_mics,
            is_clipboard_history_enabled,
            open_windows_settings,
            is_autostart_enabled,
            set_autostart_enabled,
            reset_pill_position,
            open_settings_window,
            minimize_window,
            toggle_maximize_window,
            close_window,
            hide_pill_window,
            cancel_recording,
            get_history,
            delete_history_item,
            clear_history,
            get_dashboard_stats,
            reset_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
