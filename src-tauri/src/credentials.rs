//! REREAL Spitit v3: Secure Storage for Groq API Key
//! Uses Windows Credential Manager as primary storage with DPAPI-encrypted file fallback (%LOCALAPPDATA%\Spitit\api_key.enc).
//! DPAPI ensures the key is encrypted with the current Windows user's master key.
//! No plain-text keys are ever stored on disk.

use keyring::Entry;
use std::path::PathBuf;

const SERVICE_NAME: &str = "REREAL_Spitit";
const USER_NAME: &str = "Groq_API_Key";

#[repr(C)]
struct DATA_BLOB {
    cb_data: u32,
    pb_data: *mut u8,
}

#[link(name = "crypt32")]
extern "system" {
    fn CryptProtectData(
        p_data_in: *const DATA_BLOB,
        sz_data_descr: *const u16,
        p_optional_entropy: *const DATA_BLOB,
        pv_reserved: *mut std::ffi::c_void,
        p_prompt_struct: *mut std::ffi::c_void,
        dw_flags: u32,
        p_data_out: *mut DATA_BLOB,
    ) -> i32;

    fn CryptUnprotectData(
        p_data_in: *const DATA_BLOB,
        ppsz_data_descr: *mut *mut u16,
        p_optional_entropy: *const DATA_BLOB,
        pv_reserved: *mut std::ffi::c_void,
        p_prompt_struct: *mut std::ffi::c_void,
        dw_flags: u32,
        p_data_out: *mut DATA_BLOB,
    ) -> i32;
}

#[link(name = "kernel32")]
extern "system" {
    fn LocalFree(h_mem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
}

const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x01;

fn dpapi_encrypt(plaintext: &[u8]) -> Result<Vec<u8>, String> {
    let in_blob = DATA_BLOB {
        cb_data: plaintext.len() as u32,
        pb_data: plaintext.as_ptr() as *mut u8,
    };
    let mut out_blob = DATA_BLOB {
        cb_data: 0,
        pb_data: std::ptr::null_mut(),
    };
    let ret = unsafe {
        CryptProtectData(
            &in_blob,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out_blob,
        )
    };
    if ret == 0 {
        return Err("CryptProtectData failed".into());
    }
    let slice = unsafe { std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize) };
    let vec = slice.to_vec();
    unsafe {
        LocalFree(out_blob.pb_data as *mut _);
    }
    Ok(vec)
}

fn dpapi_decrypt(ciphertext: &[u8]) -> Result<Vec<u8>, String> {
    let in_blob = DATA_BLOB {
        cb_data: ciphertext.len() as u32,
        pb_data: ciphertext.as_ptr() as *mut u8,
    };
    let mut out_blob = DATA_BLOB {
        cb_data: 0,
        pb_data: std::ptr::null_mut(),
    };
    let ret = unsafe {
        CryptUnprotectData(
            &in_blob,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut out_blob,
        )
    };
    if ret == 0 {
        return Err("CryptUnprotectData failed".into());
    }
    let slice = unsafe { std::slice::from_raw_parts(out_blob.pb_data, out_blob.cb_data as usize) };
    let vec = slice.to_vec();
    unsafe {
        LocalFree(out_blob.pb_data as *mut _);
    }
    Ok(vec)
}

fn encrypted_fallback_path() -> Option<PathBuf> {
    let appdata = std::env::var_os("LOCALAPPDATA").or_else(|| std::env::var_os("APPDATA"))?;
    let dir = PathBuf::from(appdata).join("Spitit");
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("api_key.enc"))
}

fn legacy_plain_key_path() -> Option<PathBuf> {
    let appdata = std::env::var_os("LOCALAPPDATA").or_else(|| std::env::var_os("APPDATA"))?;
    let path = PathBuf::from(appdata).join("Spitit").join("groq.key");
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

/// Purges legacy plain-text `groq.key` file after migrating key if needed.
fn cleanup_legacy_key_file() {
    if let Some(path) = legacy_plain_key_path() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            let trimmed = content.trim();
            if !trimmed.is_empty() {
                let _ = save_api_key(trimmed);
            }
        }
        let _ = std::fs::remove_file(path);
    }
}

pub fn save_api_key(api_key: &str) -> Result<(), String> {
    let trimmed = api_key.trim();
    if trimmed.is_empty() {
        return delete_api_key();
    }

    cleanup_legacy_key_file();

    let mut saved_somewhere = false;
    let mut err_msg = String::new();

    // 1. Save to Windows Credential Manager
    if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
        if let Err(e) = entry.set_password(trimmed) {
            err_msg.push_str(&format!("Credential Manager write error: {e}; "));
        } else {
            saved_somewhere = true;
        }
    }

    // 2. Save DPAPI-encrypted file fallback
    if let Some(enc_path) = encrypted_fallback_path() {
        match dpapi_encrypt(trimmed.as_bytes()) {
            Ok(encrypted_bytes) => {
                if let Err(e) = std::fs::write(&enc_path, encrypted_bytes) {
                    err_msg.push_str(&format!("DPAPI file write error: {e}; "));
                } else {
                    saved_somewhere = true;
                }
            }
            Err(e) => {
                err_msg.push_str(&format!("DPAPI encryption error: {e}; "));
            }
        }
    }

    if saved_somewhere {
        println!("[Spitit Credentials] API key saved successfully.");
        Ok(())
    } else {
        Err(format!("Failed to save API key to any storage: {err_msg}"))
    }
}

pub fn get_api_key() -> Result<String, String> {
    cleanup_legacy_key_file();

    // 1. Try Windows Credential Manager
    if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
        if let Ok(key) = entry.get_password() {
            let trimmed = key.trim().to_string();
            if !trimmed.is_empty() {
                println!("[Spitit Credentials] Loaded API key from Windows Credential Manager.");
                // Ensure DPAPI fallback is kept in sync
                if let Some(enc_path) = encrypted_fallback_path() {
                    if !enc_path.exists() {
                        if let Ok(enc_bytes) = dpapi_encrypt(trimmed.as_bytes()) {
                            let _ = std::fs::write(enc_path, enc_bytes);
                        }
                    }
                }
                return Ok(trimmed);
            }
        }
    }

    // 2. Fallback: DPAPI-encrypted file
    if let Some(enc_path) = encrypted_fallback_path() {
        if enc_path.exists() {
            if let Ok(enc_bytes) = std::fs::read(&enc_path) {
                if let Ok(dec_bytes) = dpapi_decrypt(&enc_bytes) {
                    if let Ok(key) = String::from_utf8(dec_bytes) {
                        let trimmed = key.trim().to_string();
                        if !trimmed.is_empty() {
                            println!("[Spitit Credentials] Loaded API key from DPAPI-encrypted fallback.");
                            // Re-sync back to Credential Manager if possible
                            if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
                                let _ = entry.set_password(&trimmed);
                            }
                            return Ok(trimmed);
                        }
                    }
                }
            }
        }
    }

    println!("[Spitit Credentials] No API key found in storage.");
    Ok(String::new())
}

pub fn delete_api_key() -> Result<(), String> {
    cleanup_legacy_key_file();

    if let Ok(entry) = Entry::new(SERVICE_NAME, USER_NAME) {
        let _ = entry.delete_credential();
    }

    if let Some(enc_path) = encrypted_fallback_path() {
        let _ = std::fs::remove_file(enc_path);
    }

    println!("[Spitit Credentials] API key deleted.");
    Ok(())
}
