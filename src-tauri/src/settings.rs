//! REREAL Spitit v3: Persistent User Settings Storage (%LOCALAPPDATA%\\Spitit\\settings.json)
//! All visible settings persist and take effect live.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub hotkey_combo: String,
    pub hold_hotkey: String,
    pub toggle_hotkey: String,
    pub mode: String,
    pub language: String,
    pub auto_paste: bool,
    pub copy_to_clipboard: bool,
    pub play_sound: bool,
    pub sound_volume: u32,
    pub start_with_windows: bool,
    pub pill_edge_animation: bool,
    pub minimum_hold_time_ms: u32,
    pub silence_threshold: f32,
    pub microphone_device: String,
    pub save_history: bool,
    pub keep_stats: bool,
    pub onboarding_completed: bool,
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            hotkey_combo: "alt_shift".to_string(),
            hold_hotkey: "Alt+LShift".to_string(),
            toggle_hotkey: "Ctrl+Space".to_string(),
            mode: "hold".to_string(),
            language: "en".to_string(),
            auto_paste: true,
            copy_to_clipboard: true,
            play_sound: true,
            sound_volume: 70,
            start_with_windows: false,
            pill_edge_animation: true,
            minimum_hold_time_ms: 250,
            silence_threshold: 0.0015,
            microphone_device: "System default".to_string(),
            save_history: true,
            keep_stats: true,
            onboarding_completed: false,
        }
    }
}

fn settings_path() -> Option<PathBuf> {
    if let Some(appdata) = std::env::var_os("LOCALAPPDATA").or_else(|| std::env::var_os("APPDATA")) {
        let dir = PathBuf::from(appdata).join("Spitit");
        let _ = std::fs::create_dir_all(&dir);
        return Some(dir.join("settings.json"));
    }
    None
}

pub fn load_settings() -> UserSettings {
    if let Some(p) = settings_path() {
        if let Ok(data) = std::fs::read_to_string(p) {
            if let Ok(settings) = serde_json::from_str::<UserSettings>(&data) {
                return settings;
            }
        }
    }
    UserSettings::default()
}

pub fn save_settings(settings: &UserSettings) -> Result<(), String> {
    if let Some(p) = settings_path() {
        let data = serde_json::to_string_pretty(settings)
            .map_err(|e| format!("Failed to serialize settings: {e}"))?;
        std::fs::write(p, data).map_err(|e| format!("Failed to write settings: {e}"))?;
        return Ok(());
    }
    Err("Could not determine AppData directory".to_string())
}
