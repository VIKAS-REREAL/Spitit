//! REREAL Spitit v3: Persistent User Settings Storage (%LOCALAPPDATA%\Spitit\settings.json)
//! All visible settings persist and take effect live.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    #[serde(default = "default_hotkey_preset")]
    pub hotkey_preset: u8,
    #[serde(default = "default_hold_hotkey")]
    pub hold_hotkey: String,
    #[serde(default = "default_toggle_hotkey")]
    pub toggle_hotkey: String,
    #[serde(default = "default_hotkey_combo")]
    pub hotkey_combo: String,
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
    #[serde(default)]
    pub pill_x: Option<i32>,
    #[serde(default)]
    pub pill_y: Option<i32>,
    /// Target translation language code (e.g. "hi", "es"). Empty string = no translation.
    #[serde(default)]
    pub translate_to: String,
}

fn default_hotkey_preset() -> u8 {
    1
} // Alt + Left Shift (Spitit classic)
fn default_hold_hotkey() -> String {
    "Alt+LShift".to_string()
}
fn default_toggle_hotkey() -> String {
    "Alt+Space".to_string()
}
fn default_hotkey_combo() -> String {
    "alt_shift".to_string()
}

impl Default for UserSettings {
    fn default() -> Self {
        Self {
            hotkey_preset: 1, // Alt + Left Shift
            hold_hotkey: default_hold_hotkey(),
            toggle_hotkey: default_toggle_hotkey(),
            hotkey_combo: default_hotkey_combo(),
            mode: "hold".to_string(),
            language: "en".to_string(),
            auto_paste: true,
            copy_to_clipboard: true,
            play_sound: true,
            sound_volume: 70,
            start_with_windows: true,
            pill_edge_animation: true,
            minimum_hold_time_ms: 250,
            silence_threshold: 0.0015,
            microphone_device: "System default".to_string(),
            save_history: true,
            keep_stats: true,
            onboarding_completed: true,
            pill_x: None,
            pill_y: None,
            translate_to: String::new(),
        }
    }
}

fn settings_path() -> Option<PathBuf> {
    let appdata = std::env::var_os("LOCALAPPDATA").or_else(|| std::env::var_os("APPDATA"))?;
    let dir = PathBuf::from(appdata).join("Spitit");
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("settings.json"))
}

pub fn load_settings() -> UserSettings {
    if let Some(p) = settings_path() {
        if let Ok(data) = std::fs::read_to_string(p) {
            if let Ok(mut settings) = serde_json::from_str::<UserSettings>(&data) {
                // If legacy file did not have hotkey_preset specified, map from hold_hotkey
                if !data.contains("\"hotkey_preset\"") {
                    settings.hotkey_preset = match settings.hold_hotkey.to_lowercase().as_str() {
                        s if s.contains("space") && s.contains("ctrl") && s.contains("alt") => 4,
                        s if s.contains("space") && s.contains("alt") => 0,
                        s if s.contains("space") && s.contains("ctrl") => 5,
                        s if s.contains("ralt") || s.contains("right alt") => 3,
                        s if s.contains("ctrl") && s.contains("shift") => 2,
                        _ => 1,
                    };
                }
                if settings.hotkey_preset > 5 {
                    settings.hotkey_preset = 1;
                }
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
