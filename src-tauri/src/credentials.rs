//! REREAL Spitit v3: Windows Credential Manager storage for API Key.
//! Strictly enforces section 3.7: Groq API key is stored ONLY in Windows Credential Manager.
//! Plain-text fallback files are eliminated, and existing groq.key files are migrated and purged.

use keyring::Entry;
use std::path::PathBuf;

const SERVICE_NAME: &str = "REREAL_Spitit";
const USER_NAME: &str = "Groq_API_Key";

fn legacy_key_path() -> Option<PathBuf> {
    if let Some(appdata) = std::env::var_os("LOCALAPPDATA").or_else(|| std::env::var_os("APPDATA")) {
        let path = PathBuf::from(appdata).join("Spitit").join("groq.key");
        if path.exists() {
            return Some(path);
        }
    }
    None
}

/// Migrates and permanently purges any legacy plain-text `groq.key` file from disk.
fn cleanup_legacy_key_file() {
    if let Some(path) = legacy_key_path() {
        // Read key if needed
        if let Ok(content) = std::fs::read_to_string(&path) {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
                    if entry.get_password().unwrap_or_default().trim().is_empty() {
                        let _ = entry.set_password(trimmed);
                    }
                }
            }
        }
        // Permanently delete plain-text file
        let _ = std::fs::remove_file(path);
    }
}

pub fn save_api_key(api_key: &str) -> Result<(), String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return delete_api_key();
    }

    // Ensure legacy file is removed if it exists
    cleanup_legacy_key_file();

    let entry = Entry::new(SERVICE_NAME, USER_NAME)
        .map_err(|e| format!("Failed to access Windows Credential Manager: {e}"))?;

    entry
        .set_password(trimmed)
        .map_err(|e| format!("Failed to write API key to Windows Credential Manager: {e}"))?;

    Ok(())
}

pub fn get_api_key() -> Result<String, String> {
    // Migrate and delete any existing plain-text file
    cleanup_legacy_key_file();

    let entry = Entry::new(SERVICE_NAME, USER_NAME)
        .map_err(|e| format!("Failed to access Windows Credential Manager: {e}"))?;

    match entry.get_password() {
        Ok(key) => Ok(key.trim().to_string()),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(format!("Windows Credential Manager query failed: {e}")),
    }
}

pub fn delete_api_key() -> Result<(), String> {
    cleanup_legacy_key_file();

    if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
        let _ = entry.delete_credential();
    }
    Ok(())
}
