//! REREAL Spitit v3: Active Foreground Application Tracker & Icon Extractor.
//! Uses SetWinEventHook(EVENT_SYSTEM_FOREGROUND) to detect foreground window switches,
//! resolves executable paths, detects active browser tabs & UWP apps (like WhatsApp),
//! and extracts icons directly from window handles (WM_GETICON) or exe binaries.

use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use windows::Win32::Foundation::{CloseHandle, HWND, WPARAM, LPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP,
    BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HDC,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
pub const WINEVENT_OUTOFCONTEXT: u32 = 0;
pub const WINEVENT_SKIPOWNPROCESS: u32 = 2;
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::{
    DestroyIcon, GetForegroundWindow, GetIconInfo, GetWindowTextW, GetWindowThreadProcessId,
    SendMessageTimeoutW, EVENT_SYSTEM_FOREGROUND, HICON, ICONINFO, ICON_BIG, ICON_SMALL,
    SMTO_ABORTIFHUNG, WM_GETICON,
};

#[derive(Debug, Clone, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub exe_path: String,
    pub icon_data_url: Option<String>,
}

pub struct AppTracker {
    cache: Arc<Mutex<HashMap<String, Option<String>>>>,
}

impl AppTracker {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_current_app(&self) -> AppInfo {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return fallback_app_info();
            }

            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, &mut title_buf);
            let window_title = if title_len > 0 {
                String::from_utf16_lossy(&title_buf[..title_len as usize])
            } else {
                String::new()
            };

            let mut pid = 0u32;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 {
                return fallback_app_info();
            }

            let process_handle = match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                Ok(h) => h,
                Err(_) => return fallback_app_info(),
            };

            let mut path_buf = [0u16; 1024];
            let mut size = path_buf.len() as u32;
            let query_res = QueryFullProcessImageNameW(
                process_handle,
                PROCESS_NAME_FORMAT(0),
                windows::core::PWSTR(path_buf.as_mut_ptr()),
                &mut size,
            );
            let _ = CloseHandle(process_handle);

            if query_res.is_err() || size == 0 {
                return fallback_app_info();
            }

            let exe_path = String::from_utf16_lossy(&path_buf[..size as usize]);
            let stem = Path::new(&exe_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Active App")
                .to_string();

            let stem_lower = stem.to_lowercase();
            let title_lower = window_title.to_lowercase();

            let mut display_name = stem.clone();

            // Detect WhatsApp (desktop & Windows Store UWP)
            if stem_lower.contains("whatsapp") || title_lower.contains("whatsapp") {
                display_name = "WhatsApp".to_string();
            } else if stem_lower == "applicationframehost" {
                if !window_title.is_empty() {
                    display_name = window_title.split('-').next().unwrap_or(&window_title).trim().to_string();
                }
            } else if stem_lower == "chrome"
                || stem_lower == "msedge"
                || stem_lower == "brave"
                || stem_lower == "firefox"
            {
                // Active browser tab / website identification
                if title_lower.contains("whatsapp") {
                    display_name = "WhatsApp Web".to_string();
                } else if title_lower.contains("youtube") {
                    display_name = "YouTube".to_string();
                } else if title_lower.contains("github") {
                    display_name = "GitHub".to_string();
                } else if title_lower.contains("gmail") {
                    display_name = "Gmail".to_string();
                } else if title_lower.contains("chatgpt") {
                    display_name = "ChatGPT".to_string();
                } else if title_lower.contains("claude") {
                    display_name = "Claude".to_string();
                } else if title_lower.contains("slack") {
                    display_name = "Slack".to_string();
                } else if title_lower.contains("notion") {
                    display_name = "Notion".to_string();
                } else if title_lower.contains("figma") {
                    display_name = "Figma".to_string();
                } else if title_lower.contains("twitter") || title_lower.contains(" x ") || window_title.ends_with("/ X") {
                    display_name = "X".to_string();
                } else if title_lower.contains("google docs") || title_lower.contains("google sheets") {
                    display_name = "Google Docs".to_string();
                } else if title_lower.contains("reddit") {
                    display_name = "Reddit".to_string();
                } else if title_lower.contains("linkedin") {
                    display_name = "LinkedIn".to_string();
                } else if !window_title.is_empty() {
                    if let Some(pos) = window_title.rfind(" - ") {
                        let prefix = window_title[..pos].trim();
                        if !prefix.is_empty() && prefix.len() <= 20 {
                            display_name = prefix.to_string();
                        }
                    }
                }
            } else if stem_lower == "code" {
                display_name = "VS Code".to_string();
            } else if stem_lower == "notepad" {
                display_name = "Notepad".to_string();
            }

            // Extract icon: first try directly from window handle (works on WhatsApp & UWP)
            let cache_key = format!("{}:{}", display_name, exe_path);
            let icon_data_url = {
                let mut cache_lock = self.cache.lock().unwrap();
                if let Some(cached) = cache_lock.get(&cache_key) {
                    cached.clone()
                } else {
                    let extracted = extract_icon_from_hwnd(hwnd)
                        .or_else(|| extract_icon_from_exe(&exe_path));
                    cache_lock.insert(cache_key, extracted.clone());
                    extracted
                }
            };

            AppInfo {
                name: display_name,
                exe_path,
                icon_data_url,
            }
        }
    }
}

fn fallback_app_info() -> AppInfo {
    AppInfo {
        name: "Active App".to_string(),
        exe_path: "".to_string(),
        icon_data_url: None,
    }
}

/// Tries extracting the icon directly from the HWND using WM_GETICON.
/// This works for packaged apps like WhatsApp, Telegram, etc., where file ACLs block disk reads.
unsafe fn extract_icon_from_hwnd(hwnd: HWND) -> Option<String> {
    let mut hicon_val = 0usize;
    let _ = SendMessageTimeoutW(
        hwnd,
        WM_GETICON,
        WPARAM(ICON_BIG as usize),
        LPARAM(0),
        SMTO_ABORTIFHUNG,
        40,
        Some(&mut hicon_val),
    );
    if hicon_val != 0 {
        return hicon_to_data_url(HICON(hicon_val as *mut _), false);
    }

    let _ = SendMessageTimeoutW(
        hwnd,
        WM_GETICON,
        WPARAM(ICON_SMALL as usize),
        LPARAM(0),
        SMTO_ABORTIFHUNG,
        40,
        Some(&mut hicon_val),
    );
    if hicon_val != 0 {
        return hicon_to_data_url(HICON(hicon_val as *mut _), false);
    }

    None
}

/// Extracts the 32bpp icon for the given executable path via SHGetFileInfoW.
unsafe fn extract_icon_from_exe(exe_path: &str) -> Option<String> {
    let wide_path: Vec<u16> = exe_path.encode_utf16().chain(std::iter::once(0)).collect();
    let mut shfi = SHFILEINFOW::default();

    let res = SHGetFileInfoW(
        windows::core::PCWSTR(wide_path.as_ptr()),
        windows::Win32::Storage::FileSystem::FILE_FLAGS_AND_ATTRIBUTES(0),
        Some(&mut shfi),
        std::mem::size_of::<SHFILEINFOW>() as u32,
        SHGFI_ICON | SHGFI_LARGEICON,
    );

    if res == 0 || shfi.hIcon.0.is_null() {
        return None;
    }

    hicon_to_data_url(shfi.hIcon, true)
}

/// Converts an HICON to a base64 BMP data URL.
unsafe fn hicon_to_data_url(hicon: HICON, should_destroy: bool) -> Option<String> {
    let mut icon_info = ICONINFO::default();
    if GetIconInfo(hicon, &mut icon_info).is_err() {
        if should_destroy {
            let _ = DestroyIcon(hicon);
        }
        return None;
    }

    let hbm_color = icon_info.hbmColor;
    if hbm_color.0.is_null() {
        if should_destroy {
            let _ = DestroyIcon(hicon);
        }
        if !icon_info.hbmMask.0.is_null() {
            let _ = DeleteObject(icon_info.hbmMask);
        }
        return None;
    }

    let mut bmp = BITMAP::default();
    if GetObjectW(
        hbm_color,
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bmp as *mut _ as *mut _),
    ) == 0
    {
        if should_destroy {
            let _ = DestroyIcon(hicon);
        }
        let _ = DeleteObject(icon_info.hbmColor);
        if !icon_info.hbmMask.0.is_null() {
            let _ = DeleteObject(icon_info.hbmMask);
        }
        return None;
    }

    let width = bmp.bmWidth;
    let height = bmp.bmHeight;
    let image_size = (width * height * 4) as usize;

    let hdc = CreateCompatibleDC(HDC(std::ptr::null_mut()));
    let mut bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height, // negative for top-down DIB
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            biSizeImage: image_size as u32,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        },
        ..Default::default()
    };

    let mut pixels = vec![0u8; image_size];
    let lines = GetDIBits(
        hdc,
        hbm_color,
        0,
        height as u32,
        Some(pixels.as_mut_ptr() as *mut _),
        &mut bmi,
        DIB_RGB_COLORS,
    );

    let _ = DeleteDC(hdc);
    let _ = DeleteObject(icon_info.hbmColor);
    if !icon_info.hbmMask.0.is_null() {
        let _ = DeleteObject(icon_info.hbmMask);
    }
    if should_destroy {
        let _ = DestroyIcon(hicon);
    }

    if lines == 0 {
        return None;
    }

    // Construct 32-bit BMP in memory
    let file_header_size = 14usize;
    let info_header_size = 40usize;
    let total_file_size = file_header_size + info_header_size + image_size;

    let mut bmp_bytes = Vec::with_capacity(total_file_size);

    // BITMAPFILEHEADER (14 bytes)
    bmp_bytes.extend_from_slice(b"BM");
    bmp_bytes.extend_from_slice(&(total_file_size as u32).to_le_bytes());
    bmp_bytes.extend_from_slice(&0u16.to_le_bytes()); // bfReserved1
    bmp_bytes.extend_from_slice(&0u16.to_le_bytes()); // bfReserved2
    bmp_bytes.extend_from_slice(&((file_header_size + info_header_size) as u32).to_le_bytes()); // bfOffBits

    // BITMAPINFOHEADER (40 bytes)
    bmp_bytes.extend_from_slice(&(info_header_size as u32).to_le_bytes());
    bmp_bytes.extend_from_slice(&(width as i32).to_le_bytes());
    bmp_bytes.extend_from_slice(&(-(height as i32)).to_le_bytes());
    bmp_bytes.extend_from_slice(&1u16.to_le_bytes()); // biPlanes
    bmp_bytes.extend_from_slice(&32u16.to_le_bytes()); // biBitCount
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes()); // BI_RGB
    bmp_bytes.extend_from_slice(&(image_size as u32).to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());
    bmp_bytes.extend_from_slice(&0u32.to_le_bytes());

    // Pixel data
    bmp_bytes.extend_from_slice(&pixels);

    let b64 = base64_encode(&bmp_bytes);
    Some(format!("data:image/bmp;base64,{b64}"))
}

fn base64_encode(data: &[u8]) -> String {
    const CHARSET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((data.len() + 2) / 3 * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        out.push(CHARSET[(b0 >> 2) as usize] as char);
        out.push(CHARSET[(((b0 & 3) << 4) | (b1 >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(CHARSET[(((b1 & 0xF) << 2) | (b2 >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(CHARSET[(b2 & 0x3F) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

use tauri::Emitter;

static mut GLOBAL_TRACKER: Option<(tauri::AppHandle, Arc<AppTracker>)> = None;

pub fn start_tracking(handle: tauri::AppHandle, tracker: Arc<AppTracker>) {
    unsafe {
        GLOBAL_TRACKER = Some((handle, tracker));
    }

    std::thread::spawn(|| {
        unsafe {
            let _hook = SetWinEventHook(
                EVENT_SYSTEM_FOREGROUND,
                EVENT_SYSTEM_FOREGROUND,
                None,
                Some(win_event_hook_callback),
                0,
                0,
                WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS,
            );

            let mut msg = windows::Win32::UI::WindowsAndMessaging::MSG::default();
            while windows::Win32::UI::WindowsAndMessaging::GetMessageW(
                &mut msg,
                HWND(std::ptr::null_mut()),
                0,
                0,
            )
            .as_bool()
            {
                let _ = windows::Win32::UI::WindowsAndMessaging::TranslateMessage(&msg);
                let _ = windows::Win32::UI::WindowsAndMessaging::DispatchMessageW(&msg);
            }
        }
    });
}

unsafe extern "system" fn win_event_hook_callback(
    _h_hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _id_event_thread: u32,
    _dwms_event_time: u32,
) {
    if event == EVENT_SYSTEM_FOREGROUND && !hwnd.0.is_null() {
        if let Some((handle, tracker)) = &GLOBAL_TRACKER {
            let app_info = tracker.get_current_app();
            let _ = handle.emit("foreground_app_changed", &app_info);
        }
    }
}
