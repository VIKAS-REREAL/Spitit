//! REREAL Spitit v3: Windows Credential Manager storage for API Key.

use keyring::Entry;

const SERVICE_NAME: &str = "REREAL_Spitit";
const USER_NAME: &str = "Groq_API_Key";

pub fn save_api_key(api_key: &str) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, USER_NAME)
        .map_err(|e| format!("Failed to access Credential Manager: {e}"))?;
    entry
        .set_password(api_key.trim())
        .map_err(|e| format!("Failed to save API key: {e}"))?;
    Ok(())
}

pub fn get_api_key() -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, USER_NAME)
        .map_err(|e| format!("Failed to access Credential Manager: {e}"))?;
    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => Ok(String::new()),
        Err(e) => Err(format!("Failed to retrieve API key: {e}")),
    }
}

pub fn delete_api_key() -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, USER_NAME)
        .map_err(|e| format!("Failed to access Credential Manager: {e}"))?;
    match entry.delete_password() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete API key: {e}")),
    }
}
