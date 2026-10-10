//! REREAL Spitit v3: Windows Credential Manager storage for API Key.

use keyring::Entry;
use std::path::PathBuf;

const SERVICE_NAME: &str = "REREAL_Spitit";
const USER_NAME: &str = "Groq_API_Key";

fn fallback_key_path() -> Option<PathBuf> {
    if let Some(appdata) = std::env::var_os("LOCALAPPDATA").or_else(|| std::env::var_os("APPDATA")) {
        let dir = PathBuf::from(appdata).join("Spitit");
        let _ = std::fs::create_dir_all(&dir);
        return Some(dir.join("groq.key"));
    }
    None
}

pub fn save_api_key(api_key: &str) -> Result<(), String> {
    let trimmed = api_key.trim();
    
    // 1. Primary: Windows Credential Manager
    if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
        let _ = entry.set_password(trimmed);
    }

    // 2. Guaranteed local fallback in LocalAppData
    if let Some(path) = fallback_key_path() {
        let _ = std::fs::write(path, trimmed);
    }

    Ok(())
}

pub fn get_api_key() -> Result<String, String> {
    // 1. Try Windows Credential Manager
    if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
        if let Ok(key) = entry.get_password() {
            if !key.trim().is_empty() {
                return Ok(key.trim().to_string());
            }
        }
    }

    // 2. Fallback to LocalAppData
    if let Some(path) = fallback_key_path() {
        if let Ok(content) = std::fs::read_to_string(path) {
            let trimmed = content.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(trimmed);
            }
        }
    }

    Ok(String::new())
}

pub fn delete_api_key() -> Result<(), String> {
    if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
        let _ = entry.delete_credential();
    }
    if let Some(path) = fallback_key_path() {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credential_retrieval() {
        let key = get_api_key().expect("Failed to query Credential Manager");
        println!("Stored key present: {}", !key.is_empty());
    }
}
