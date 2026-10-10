//! REREAL Spitit v3: Tauri Application Core & IPC Handlers.

mod app_tracker;
mod credentials;
mod hotkey;
mod paster;
mod recorder;
mod settings;
mod transcriber;

use app_tracker::AppTracker;
use hotkey::{ActivationMode, HotkeyCombo, HotkeyEvent, HotkeyManager};
use recorder::AudioRecorder;
use serde::Serialize;
use settings::UserSettings;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, Wry,
};
use windows::core::PCWSTR;
use windows::Win32::System::Registry::{
    RegCloseKey, RegDeleteValueW, RegOpenKeyExW, RegQueryValueExW, RegSetValueExW,
    HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_SZ,
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
    recorder: Mutex<AudioRecorder>,
    hotkey_mgr: HotkeyManager,
    language: Mutex<String>,
    app_tracker: Arc<AppTracker>,
    api_key: Mutex<String>,
    settings: Mutex<UserSettings>,
    tray_lang_items: Mutex<Option<(CheckMenuItem<Wry>, CheckMenuItem<Wry>)>>,
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
                use windows::Win32::UI::WindowsAndMessaging::{
                    BringWindowToTop, SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
                };
                let hwnd = windows::Win32::Foundation::HWND(hwnd_val.0 as _);
                let _ = ShowWindow(hwnd, SW_RESTORE);
                let _ = ShowWindow(hwnd, SW_SHOW);
                let _ = SetForegroundWindow(hwnd);
                let _ = BringWindowToTop(hwnd);
            }
        }
    }
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
fn save_all_settings(state: tauri::State<AppState>, app: tauri::AppHandle, new_settings: UserSettings) -> Result<(), String> {
    let mode = match new_settings.mode.to_lowercase().as_str() {
        "toggle" => ActivationMode::Toggle,
        _ => ActivationMode::Hold,
    };
    state.hotkey_mgr.set_mode(mode);

    let combo = match new_settings.hotkey_combo.to_lowercase().as_str() {
        "ctrl_space" => HotkeyCombo::CtrlSpace,
        "alt_space" => HotkeyCombo::AltSpace,
        "ctrl_shift" => HotkeyCombo::CtrlShift,
        "right_alt" => HotkeyCombo::RightAlt,
        _ => HotkeyCombo::AltShift,
    };
    state.hotkey_mgr.set_combo(combo);

    *state.language.lock().unwrap() = new_settings.language.clone();
    *state.settings.lock().unwrap() = new_settings.clone();
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
fn get_mode(state: tauri::State<AppState>) -> String {
    match state.hotkey_mgr.get_mode() {
        ActivationMode::Hold => "hold".to_string(),
        ActivationMode::Toggle => "toggle".to_string(),
    }
}

#[tauri::command]
fn set_mode(state: tauri::State<AppState>, mode_str: String) -> Result<(), String> {
    let mode = match mode_str.to_lowercase().as_str() {
        "toggle" => ActivationMode::Toggle,
        _ => ActivationMode::Hold,
    };
    state.hotkey_mgr.set_mode(mode);
    let mut s = state.settings.lock().unwrap();
    s.mode = mode_str;
    let _ = settings::save_settings(&s);
    Ok(())
}

#[tauri::command]
fn get_hotkey_combo(state: tauri::State<AppState>) -> String {
    match state.hotkey_mgr.get_combo() {
        HotkeyCombo::AltShift => "alt_shift".to_string(),
        HotkeyCombo::CtrlSpace => "ctrl_space".to_string(),
        HotkeyCombo::AltSpace => "alt_space".to_string(),
        HotkeyCombo::CtrlShift => "ctrl_shift".to_string(),
        HotkeyCombo::RightAlt => "right_alt".to_string(),
    }
}

#[tauri::command]
fn set_hotkey_combo(state: tauri::State<AppState>, combo_str: String) -> Result<(), String> {
    let combo = match combo_str.to_lowercase().as_str() {
        "ctrl_space" => HotkeyCombo::CtrlSpace,
        "alt_space" => HotkeyCombo::AltSpace,
        "ctrl_shift" => HotkeyCombo::CtrlShift,
        "right_alt" => HotkeyCombo::RightAlt,
        _ => HotkeyCombo::AltShift,
    };
    state.hotkey_mgr.set_combo(combo);
    let mut s = state.settings.lock().unwrap();
    s.hotkey_combo = combo_str;
    let _ = settings::save_settings(&s);
    Ok(())
}

#[tauri::command]
fn get_language(state: tauri::State<AppState>) -> String {
    state.language.lock().unwrap().clone()
}

#[tauri::command]
fn set_language(state: tauri::State<AppState>, app: tauri::AppHandle, lang: String) -> Result<(), String> {
    *state.language.lock().unwrap() = lang.clone();
    let mut s = state.settings.lock().unwrap();
    s.language = lang.clone();
    let _ = settings::save_settings(&s);
    let _ = app.emit("language_changed", &lang);
    let tray_items = state.tray_lang_items.lock().unwrap().clone();
    if let Some((en_item, hi_item)) = tray_items {
        let is_en = lang != "hinglish";
        let _ = en_item.set_checked(is_en);
        let _ = hi_item.set_checked(!is_en);
    }
    Ok(())
}

#[tauri::command]
fn open_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    bring_main_window_to_front(&app);
    Ok(())
}

/// Instant Win32 Registry check: zero sub-processes, 0 flashing windows, completely silent.
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
        .ok()
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
            res.ok().is_ok()
        } else {
            false
        }
    }
}

/// Instant Win32 Registry configuration: zero PowerShell processes, 0 lag.
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
            let val = format!("\"{}\"", current_exe.to_string_lossy());
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

#[tauri::command]
fn start_manual_record(state: tauri::State<AppState>, app: tauri::AppHandle) -> Result<(), String> {
    let app_info = state.app_tracker.get_current_app();
    let _ = app.emit("foreground_app_changed", &app_info);
    let _ = app.emit("recording_state", "recording");

    if let Some(pill_win) = app.get_webview_window("pill") {
        let _ = pill_win.show();
    }

    let mut rec = state.recorder.lock().unwrap();
    rec.start()
}

#[tauri::command]
async fn stop_manual_record(
    state: tauri::State<'_, AppState>,
    app: tauri::AppHandle,
) -> Result<String, String> {
    let _ = app.emit("recording_state", "processing");
    let wav_opt = {
        let mut rec = state.recorder.lock().unwrap();
        rec.stop()?
    };

    let wav_bytes = match wav_opt {
        Some(b) => b,
        None => {
            let _ = app.emit("recording_state", "cancelled");
            return Ok("Audio too short".into());
        }
    };

    let api_key = {
        let k = state.api_key.lock().unwrap().clone();
        if !k.is_empty() {
            k
        } else {
            credentials::get_api_key().unwrap_or_default()
        }
    };

    if api_key.is_empty() {
        let _ = app.emit("recording_state", "no_api_key");
        return Err("No API key configured. Please enter your Groq API key in Settings.".into());
    }

    let lang = state.language.lock().unwrap().clone();
    let text = transcriber::transcribe(wav_bytes, &api_key, &lang).await?;
    let _ = paster::paste_text(&text);

    let duration = state.recorder.lock().unwrap().get_last_duration();
    let word_count = text.split_whitespace().count();
    let wpm = if duration >= 0.5 {
        ((word_count as f32 / duration) * 60.0).round() as u32
    } else {
        0
    };
    let app_info = state.app_tracker.get_current_app();
    let meta = TranscriptMeta {
        text: text.clone(),
        word_count,
        duration_secs: duration,
        wpm,
        app_name: app_info.name,
        app_icon: app_info.icon_data_url,
    };
    let _ = app.emit("transcript_meta", &meta);
    let _ = app.emit("transcript_done", &text);
    Ok(text)
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
    {
        let mut rec = state.recorder.lock().unwrap();
        rec.cancel();
    }
    let _ = app.emit("recording_state", "cancelled");
    hide_pill_window(app)
}

#[tauri::command]
fn save_pill_screenshot(data_url: String) -> Result<String, String> {
    use std::fs;
    let parts: Vec<&str> = data_url.split(',').collect();
    if parts.len() != 2 {
        return Err("Invalid data URL".into());
    }
    let base64_str = parts[1];
    let bytes = base64_decode(base64_str)?;

    let appdata = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\temp".into());
    let path = format!("{}\\Spitit\\real_tauri_pill.png", appdata);
    let _ = fs::create_dir_all(format!("{}\\Spitit", appdata));
    fs::write(&path, bytes).map_err(|e| e.to_string())?;

    Ok(path)
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut clean = input.replace(&['\r', '\n', ' '][..], "");
    while clean.len() % 4 != 0 {
        clean.push('=');
    }
    let mut out = Vec::with_capacity(clean.len() * 3 / 4);
    let bytes = clean.as_bytes();

    let mut i = 0;
    while i < bytes.len() {
        let mut buf = 0u32;
        let mut count = 0;
        for j in 0..4 {
            let b = bytes[i + j];
            if b == b'=' {
                break;
            }
            if let Some(pos) = TABLE.iter().position(|&x| x == b) {
                buf = (buf << 6) | (pos as u32);
                count += 1;
            }
        }
        if count >= 2 {
            out.push((buf >> (16 - (4 - count) * 6)) as u8);
        }
        if count >= 3 {
            out.push(((buf >> 8) & 0xFF) as u8);
        }
        if count == 4 {
            out.push((buf & 0xFF) as u8);
        }
        i += 4;
    }
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_settings = settings::load_settings();

    let combo = match initial_settings.hotkey_combo.as_str() {
        "ctrl_space" => HotkeyCombo::CtrlSpace,
        "alt_space" => HotkeyCombo::AltSpace,
        "ctrl_shift" => HotkeyCombo::CtrlShift,
        "right_alt" => HotkeyCombo::RightAlt,
        _ => HotkeyCombo::AltShift,
    };

    let mode = match initial_settings.mode.as_str() {
        "toggle" => ActivationMode::Toggle,
        _ => ActivationMode::Hold,
    };

    let (hotkey_mgr, rx) = HotkeyManager::new(mode, combo);
    hotkey_mgr.start();

    let tracker = Arc::new(AppTracker::new());
    let init_key = credentials::get_api_key().unwrap_or_default();

    let app_state = AppState {
        recorder: Mutex::new(AudioRecorder::new()),
        hotkey_mgr,
        language: Mutex::new(initial_settings.language.clone()),
        app_tracker: tracker.clone(),
        api_key: Mutex::new(init_key.clone()),
        settings: Mutex::new(initial_settings.clone()),
        tray_lang_items: Mutex::new(None),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When user opens Spitit from Windows Search / Start Menu while already running
            bring_main_window_to_front(app);
        }))
        .manage(app_state)
        .setup(move |app| {
            let handle = app.handle().clone();

            // Set explicit taskbar and window icon on the main window
            if let Some(main_win) = app.get_webview_window("main") {
                if let Some(icon) = app.default_window_icon() {
                    let _ = main_win.set_icon(icon.clone());
                }
            }

            // If API key is not configured, show main window on initial launch
            if init_key.is_empty() {
                bring_main_window_to_front(&handle);
            }

            // Setup System Tray with official icon and menu (including Language Quick Swap)
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

            // Save tray check items in AppState for two-way live sync with settings UI
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
            let tracker_for_hook = tracker.clone();
            app_tracker::start_tracking(handle.clone(), tracker_for_hook);

            // Configure Pill window: tight Superwhisper style (160x38), frameless, transparent, WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW
            if let Some(pill_win) = app.get_webview_window("pill") {
                if let Ok(raw_hwnd) = pill_win.hwnd() {
                    let hwnd = windows::Win32::Foundation::HWND(raw_hwnd.0 as _);
                    unsafe {
                        use windows::Win32::UI::WindowsAndMessaging::{
                            GetSystemMetrics, GetWindowLongW, SetWindowLongW, SetWindowPos,
                            GWL_EXSTYLE, HWND_TOPMOST, SM_CXSCREEN, SM_CYSCREEN, SWP_HIDEWINDOW,
                            SWP_NOACTIVATE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
                        };

                        let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
                        SetWindowLongW(
                            hwnd,
                            GWL_EXSTYLE,
                            ex_style
                                | (WS_EX_NOACTIVATE.0 as i32)
                                | (WS_EX_TOOLWINDOW.0 as i32),
                        );

                        let screen_w = GetSystemMetrics(SM_CXSCREEN);
                        let screen_h = GetSystemMetrics(SM_CYSCREEN);
                        let pill_w = 160;
                        let pill_h = 38;
                        let x = (screen_w - pill_w) / 2;
                        let y = screen_h - 90;
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
                }
            }

            // Background worker thread for hotkey events
            let handle_worker = handle.clone();
            let tracker_worker = tracker.clone();

            std::thread::spawn(move || {
                tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .unwrap()
                    .block_on(async move {
                        while let Ok(event) = rx.recv() {
                            let app_state = handle_worker.state::<AppState>();
                            match event {
                                HotkeyEvent::Start => {
                                    // 1. Resolve and emit active app
                                    let app_info = tracker_worker.get_current_app();
                                    let _ = handle_worker.emit("foreground_app_changed", &app_info);

                                    // 2. Show Pill window without stealing focus
                                    if let Some(pill_win) = handle_worker.get_webview_window("pill") {
                                        let _ = pill_win.show();
                                    }

                                    let _ = handle_worker.emit("recording_state", "recording");
                                    let mut rec = app_state.recorder.lock().unwrap();
                                    let _ = rec.start();
                                }
                                HotkeyEvent::Stop => {
                                    let _ = handle_worker.emit("recording_state", "processing");
                                    let wav_opt = {
                                        let mut rec = app_state.recorder.lock().unwrap();
                                        rec.stop().unwrap_or(None)
                                    };

                                    if let Some(wav_bytes) = wav_opt {
                                        let key = {
                                            let k = app_state.api_key.lock().unwrap().clone();
                                            if !k.is_empty() {
                                                k
                                            } else {
                                                credentials::get_api_key().unwrap_or_default()
                                            }
                                        };
                                        let lang = app_state.language.lock().unwrap().clone();
                                        if !key.is_empty() {
                                            match transcriber::transcribe(wav_bytes, &key, &lang).await {
                                                Ok(text) => {
                                                    // Paste into active app without stealing focus
                                                    let _ = paster::paste_text(&text);

                                                    let duration = app_state.recorder.lock().unwrap().get_last_duration();
                                                    let word_count = text.split_whitespace().count();
                                                    let wpm = if duration >= 0.5 {
                                                        ((word_count as f32 / duration) * 60.0).round() as u32
                                                    } else {
                                                        0
                                                    };
                                                    let app_info = tracker_worker.get_current_app();
                                                    let meta = TranscriptMeta {
                                                        text: text.clone(),
                                                        word_count,
                                                        duration_secs: duration,
                                                        wpm,
                                                        app_name: app_info.name,
                                                        app_icon: app_info.icon_data_url,
                                                    };
                                                    let _ = handle_worker.emit("transcript_meta", &meta);
                                                    let _ = handle_worker.emit("transcript_done", &text);
                                                }
                                                Err(e) => {
                                                    let _ = handle_worker.emit("recording_state", format!("error:{}", e));
                                                }
                                            }
                                        } else {
                                            let _ = handle_worker.emit("recording_state", "no_api_key");
                                        }
                                    } else {
                                        let _ = handle_worker.emit("recording_state", "cancelled");
                                    }
                                }
                                HotkeyEvent::Cancel => {
                                    let mut rec = app_state.recorder.lock().unwrap();
                                    rec.cancel();
                                    let _ = handle_worker.emit("recording_state", "cancelled");
                                    if let Some(pill_win) = handle_worker.get_webview_window("pill") {
                                        let _ = pill_win.hide();
                                    }
                                }
                            }
                        }
                    });
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            save_api_key,
            test_api_key,
            get_all_settings,
            save_all_settings,
            get_mode,
            set_mode,
            get_hotkey_combo,
            set_hotkey_combo,
            get_language,
            set_language,
            is_autostart_enabled,
            set_autostart_enabled,
            open_settings_window,
            minimize_window,
            toggle_maximize_window,
            close_window,
            start_manual_record,
            stop_manual_record,
            hide_pill_window,
            cancel_recording,
            save_pill_screenshot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
