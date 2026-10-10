//! REREAL Spitit v3: Tauri Application Core & IPC Handlers.

mod credentials;
mod hotkey;
mod paster;
mod recorder;
mod transcriber;

use hotkey::{ActivationMode, HotkeyEvent, HotkeyManager};
use recorder::AudioRecorder;
use std::sync::{Arc, Mutex};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

struct AppState {
    recorder: Mutex<AudioRecorder>,
    hotkey_mgr: HotkeyManager,
    language: Mutex<String>,
}

#[tauri::command]
fn get_api_key() -> Result<String, String> {
    credentials::get_api_key()
}

#[tauri::command]
fn save_api_key(api_key: String) -> Result<(), String> {
    credentials::save_api_key(&api_key)
}

#[tauri::command]
async fn test_api_key(api_key: String) -> Result<String, String> {
    transcriber::test_connection(&api_key).await
}

#[tauri::command]
fn set_mode(state: tauri::State<Arc<AppState>>, mode_str: String) -> Result<(), String> {
    let mode = match mode_str.to_lowercase().as_str() {
        "toggle" => ActivationMode::Toggle,
        _ => ActivationMode::Hold,
    };
    state.hotkey_mgr.set_mode(mode);
    Ok(())
}

#[tauri::command]
fn set_language(state: tauri::State<Arc<AppState>>, lang: String) -> Result<(), String> {
    *state.language.lock().unwrap() = lang;
    Ok(())
}

#[tauri::command]
fn start_manual_record(state: tauri::State<Arc<AppState>>) -> Result<(), String> {
    let mut rec = state.recorder.lock().unwrap();
    rec.start()
}

#[tauri::command]
async fn stop_manual_record(state: tauri::State<Arc<AppState>>) -> Result<String, String> {
    let wav_opt = {
        let mut rec = state.recorder.lock().unwrap();
        rec.stop()?
    };

    let wav_bytes = match wav_opt {
        Some(b) => b,
        None => return Ok("Audio too short".into()),
    };

    let api_key = credentials::get_api_key()?;
    let lang = state.language.lock().unwrap().clone();

    let text = transcriber::transcribe(wav_bytes, &api_key, &lang).await?;
    paster::paste_text(&text)?;
    Ok(text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (hotkey_mgr, rx) = HotkeyManager::new(ActivationMode::Hold);
    hotkey_mgr.start();

    let app_state = Arc::new(AppState {
        recorder: Mutex::new(AudioRecorder::new()),
        hotkey_mgr,
        language: Mutex::new("hinglish".to_string()),
    });

    let app_state_clone = Arc::clone(&app_state);

    tauri::Builder::default()
        // Single instance plugin: second instance opens the existing window
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .manage(app_state_clone)
        .setup(move |app| {
            let handle = app.handle().clone();

            // Setup System Tray
            let quit_i = MenuItem::with_id(&handle, "quit", "Quit Spitit", true, None::<&str>)?;
            let open_i = MenuItem::with_id(&handle, "open", "Open Spitit", true, None::<&str>)?;
            let menu = Menu::with_items(&handle, &[&open_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("REREAL - Spitit v3")
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // Background worker thread for hotkey events
            let app_state_worker = Arc::clone(&app.state::<Arc<AppState>>());
            let handle_worker = handle.clone();

            std::thread::spawn(move || {
                tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .unwrap()
                    .block_on(async move {
                        while let Ok(event) = rx.recv() {
                            match event {
                                HotkeyEvent::Start => {
                                    let _ = handle_worker.emit("recording_state", "recording");
                                    let mut rec = app_state_worker.recorder.lock().unwrap();
                                    let _ = rec.start();
                                }
                                HotkeyEvent::Stop => {
                                    let _ = handle_worker.emit("recording_state", "processing");
                                    let wav_opt = {
                                        let mut rec = app_state_worker.recorder.lock().unwrap();
                                        rec.stop().unwrap_or(None)
                                    };

                                    if let Some(wav_bytes) = wav_opt {
                                        let key = credentials::get_api_key().unwrap_or_default();
                                        let lang = app_state_worker.language.lock().unwrap().clone();
                                        if !key.is_empty() {
                                            if let Ok(text) =
                                                transcriber::transcribe(wav_bytes, &key, &lang).await
                                            {
                                                let _ = paster::paste_text(&text);
                                                let _ = handle_worker.emit("transcript_done", &text);
                                            }
                                        }
                                    }
                                    let _ = handle_worker.emit("recording_state", "idle");
                                }
                                HotkeyEvent::Cancel => {
                                    let mut rec = app_state_worker.recorder.lock().unwrap();
                                    rec.cancel();
                                    let _ = handle_worker.emit("recording_state", "cancelled");
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
            set_mode,
            set_language,
            start_manual_record,
            stop_manual_record,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
