//! REREAL Spitit v3: Active Foreground Application Tracker & Icon Extractor.
//! Complies with Section 2.5:
//! 1. Reliable PNG icon transport with clean 32-bit RGBA alpha channel (no black backgrounds).
//! 2. Resolves packaged UWP/Store apps by checking child CoreWindow.
//! 3. Retries failed lookups rather than caching None forever.
//! 4. Non-blocking asynchronous icon extraction.
//! 5. Captures target window at hotkey press for deterministic paste.

use image::{ImageBuffer, ImageFormat, Rgba};
use serde::Serialize;
use std::collections::HashMap;
use std::io::Cursor;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use windows::core::PCWSTR;
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, WPARAM};
use windows::Win32::Graphics::Gdi::{
    CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
    BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HDC,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
use windows::Win32::UI::WindowsAndMessaging::{
    DestroyIcon, FindWindowExW, GetClassLongPtrW, GetForegroundWindow, GetIconInfo, GetWindowTextW,
    GetWindowThreadProcessId, SendMessageTimeoutW, EVENT_SYSTEM_FOREGROUND, GCLP_HICON,
    GCLP_HICONSM, HICON, ICONINFO, ICON_BIG, ICON_SMALL, SMTO_ABORTIFHUNG, WM_GETICON,
};

pub const WINEVENT_OUTOFCONTEXT: u32 = 0;
pub const WINEVENT_SKIPOWNPROCESS: u32 = 2;

#[derive(Debug, Clone, Serialize)]
pub struct AppInfo {
    pub name: String,
    pub exe_path: String,
    pub icon_data_url: Option<String>,
    pub hwnd: isize,
}

struct CacheEntry {
    icon_url: Option<String>,
    timestamp: Instant,
}

pub struct AppTracker {
    cache: Arc<Mutex<HashMap<String, CacheEntry>>>,
    last_valid_app: Arc<Mutex<Option<AppInfo>>>,
}

impl AppTracker {
    pub fn new() -> Self {
        Self {
            cache: Arc::new(Mutex::new(HashMap::new())),
            last_valid_app: Arc::new(Mutex::new(None)),
        }
    }

    pub fn get_current_app(&self) -> AppInfo {
        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return self.last_valid_app.lock().unwrap().clone().unwrap_or_else(fallback_app_info);
            }
            if let Some(app) = self.resolve_app_for_hwnd_checked(hwnd) {
                app
            } else {
                self.last_valid_app.lock().unwrap().clone().unwrap_or_else(fallback_app_info)
            }
        }
    }

    #[allow(dead_code)]
    pub fn resolve_app_for_hwnd(&self, hwnd: HWND) -> AppInfo {
        self.resolve_app_for_hwnd_checked(hwnd)
            .unwrap_or_else(|| self.last_valid_app.lock().unwrap().clone().unwrap_or_else(fallback_app_info))
    }

    pub fn resolve_app_for_hwnd_checked(&self, hwnd: HWND) -> Option<AppInfo> {
        unsafe {
            let mut title_buf = [0u16; 512];
            let title_len = GetWindowTextW(hwnd, &mut title_buf);
            let window_title = if title_len > 0 {
                String::from_utf16_lossy(&title_buf[..title_len as usize])
            } else {
                String::new()
            };

            // Detect child CoreWindow for UWP ApplicationFrameHost
            let target_hwnd = resolve_real_window_hwnd(hwnd);

            let mut pid = 0u32;
            GetWindowThreadProcessId(target_hwnd, Some(&mut pid));
            if pid == 0 || pid == std::process::id() {
                return None;
            }

            let process_handle = match OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) {
                Ok(h) => h,
                Err(_) => return None,
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
                return None;
            }

            let exe_path = String::from_utf16_lossy(&path_buf[..size as usize]);

            // Filter out transient shell/desktop/taskbar windows so switching windows never glitches
            if is_transient_or_shell_window(hwnd, &exe_path) {
                return None;
            }

            let stem = Path::new(&exe_path)
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("Active App")
                .to_string();

            let stem_lower = stem.to_lowercase();
            let title_lower = window_title.to_lowercase();

            let mut display_name = stem.clone();

            if stem_lower.contains("whatsapp") || title_lower.contains("whatsapp") {
                display_name = "WhatsApp".to_string();
            } else if stem_lower == "explorer" {
                if !window_title.is_empty() && window_title != "File Explorer" {
                    display_name = window_title.clone();
                } else {
                    display_name = "File Explorer".to_string();
                }
            } else if stem_lower == "applicationframehost" {
                if !window_title.is_empty() {
                    display_name = window_title.split('-').next().unwrap_or(&window_title).trim().to_string();
                }
            } else if stem_lower == "chrome"
                || stem_lower == "msedge"
                || stem_lower == "brave"
                || stem_lower == "firefox"
            {
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

            // Extract icon with smart caching:
            // Successful icons cached indefinitely.
            // Failed lookups expire after 5 seconds so they can be retried.
            let cache_key = format!("{}:{}", display_name, exe_path);
            let icon_data_url = {
                let mut cache_lock = self.cache.lock().unwrap();
                let should_extract = match cache_lock.get(&cache_key) {
                    Some(entry) => {
                        if entry.icon_url.is_some() {
                            false
                        } else {
                            // Retry if older than 5 seconds
                            entry.timestamp.elapsed() > Duration::from_secs(5)
                        }
                    }
                    None => true,
                };

                if should_extract {
                    let extracted = extract_icon_from_hwnd(target_hwnd)
                        .or_else(|| extract_icon_from_hwnd(hwnd))
                        .or_else(|| extract_icon_from_exe(&exe_path));

                    cache_lock.insert(
                        cache_key.clone(),
                        CacheEntry {
                            icon_url: extracted.clone(),
                            timestamp: Instant::now(),
                        },
                    );
                    extracted
                } else {
                    cache_lock.get(&cache_key).and_then(|e| e.icon_url.clone())
                }
            };

            let app_info = AppInfo {
                name: display_name,
                exe_path,
                icon_data_url,
                hwnd: hwnd.0 as isize,
            };

            *self.last_valid_app.lock().unwrap() = Some(app_info.clone());
            Some(app_info)
        }
    }
}

fn fallback_app_info() -> AppInfo {
    AppInfo {
        name: "Active App".to_string(),
        exe_path: "".to_string(),
        icon_data_url: None,
        hwnd: 0,
    }
}

#[allow(dead_code)]
fn fallback_app_info_with_hwnd(hwnd: isize) -> AppInfo {
    AppInfo {
        name: "Active App".to_string(),
        exe_path: "".to_string(),
        icon_data_url: None,
        hwnd,
    }
}

/// Checks whether a window belongs to transient Windows shell elements (Taskbar, Desktop, Alt-Tab switcher)
/// or Spitit's own processes so they are never erroneously registered as target user applications.
unsafe fn is_transient_or_shell_window(hwnd: HWND, exe_path: &str) -> bool {
    let mut pid = 0u32;
    GetWindowThreadProcessId(hwnd, Some(&mut pid));
    if pid == std::process::id() {
        return true;
    }

    let mut class_buf = [0u16; 128];
    let class_len = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(hwnd, &mut class_buf);
    let class_name = if class_len > 0 {
        String::from_utf16_lossy(&class_buf[..class_len as usize])
    } else {
        String::new()
    };

    let lower_exe = exe_path.to_lowercase();
    let is_explorer = lower_exe.ends_with("explorer.exe") || lower_exe == "explorer";

    if is_explorer {
        // CabinetWClass and ExploreWClass are actual folder browsing windows
        if class_name == "CabinetWClass" || class_name == "ExploreWClass" {
            return false;
        }
        // All other explorer windows (Desktop, Taskbar, Alt-Tab switcher, Start menu) are transient shell
        return true;
    }

    if class_name == "Progman"
        || class_name == "WorkerW"
        || class_name == "Shell_TrayWnd"
        || class_name == "Shell_SecondaryTrayWnd"
        || class_name == "MultitaskingViewFrame"
        || class_name == "TaskSwitcherWnd"
        || class_name == "XamlExplorerHostIslandWindow"
    {
        return true;
    }

    false
}

/// For UWP apps, ApplicationFrameHost hosts the window. Find the child Windows.UI.Core.CoreWindow.
unsafe fn resolve_real_window_hwnd(hwnd: HWND) -> HWND {
    let mut class_buf = [0u16; 64];
    let class_len = windows::Win32::UI::WindowsAndMessaging::GetClassNameW(hwnd, &mut class_buf);
    if class_len > 0 {
        let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);
        if class_name == "ApplicationFrameWindow" {
            let core_window_class: Vec<u16> = "Windows.UI.Core.CoreWindow\0".encode_utf16().collect();
            let child = FindWindowExW(
                hwnd,
                HWND(std::ptr::null_mut()),
                PCWSTR(core_window_class.as_ptr()),
                PCWSTR(std::ptr::null()),
            );
            if let Ok(c) = child {
                if !c.0.is_null() {
                    return c;
                }
            }
        }
    }
    hwnd
}

/// Tries extracting icon from window handle via WM_GETICON or class icon.
unsafe fn extract_icon_from_hwnd(hwnd: HWND) -> Option<String> {
    // 1. WM_GETICON BIG
    let mut hicon_val = 0usize;
    let _ = SendMessageTimeoutW(
        hwnd,
        WM_GETICON,
        WPARAM(ICON_BIG as usize),
        LPARAM(0),
        SMTO_ABORTIFHUNG,
        35,
        Some(&mut hicon_val),
    );
    if hicon_val != 0 {
        return hicon_to_png_data_url(HICON(hicon_val as *mut _), false);
    }

    // 2. WM_GETICON SMALL
    let _ = SendMessageTimeoutW(
        hwnd,
        WM_GETICON,
        WPARAM(ICON_SMALL as usize),
        LPARAM(0),
        SMTO_ABORTIFHUNG,
        35,
        Some(&mut hicon_val),
    );
    if hicon_val != 0 {
        return hicon_to_png_data_url(HICON(hicon_val as *mut _), false);
    }

    // 3. Class Icon (instant, non-blocking)
    let class_icon = GetClassLongPtrW(hwnd, GCLP_HICON);
    if class_icon != 0 {
        return hicon_to_png_data_url(HICON(class_icon as *mut _), false);
    }

    let class_icon_sm = GetClassLongPtrW(hwnd, GCLP_HICONSM);
    if class_icon_sm != 0 {
        return hicon_to_png_data_url(HICON(class_icon_sm as *mut _), false);
    }

    None
}

/// Extracts 32bpp icon for executable path via SHGetFileInfoW.
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

    hicon_to_png_data_url(shfi.hIcon, true)
}

/// Converts an HICON to a high-quality 32-bit RGBA PNG data URL.
/// Solves section 2.5: crisp alpha channel with zero black background artifacts.
unsafe fn hicon_to_png_data_url(hicon: HICON, should_destroy: bool) -> Option<String> {
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

    let width = bmp.bmWidth as u32;
    let height = bmp.bmHeight as u32;
    if width == 0 || height == 0 {
        if should_destroy {
            let _ = DestroyIcon(hicon);
        }
        let _ = DeleteObject(icon_info.hbmColor);
        if !icon_info.hbmMask.0.is_null() {
            let _ = DeleteObject(icon_info.hbmMask);
        }
        return None;
    }

    let image_size = (width * height * 4) as usize;
    let hdc = CreateCompatibleDC(HDC(std::ptr::null_mut()));
    let mut bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width as i32,
            biHeight: -(height as i32), // top-down
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

    let mut bgra_pixels = vec![0u8; image_size];
    let lines = GetDIBits(
        hdc,
        hbm_color,
        0,
        height,
        Some(bgra_pixels.as_mut_ptr() as *mut _),
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

    // Convert BGRA to RGBA with alpha channel detection
    let mut has_non_zero_alpha = false;
    for chunk in bgra_pixels.chunks(4) {
        if chunk[3] > 0 {
            has_non_zero_alpha = true;
            break;
        }
    }

    let mut rgba_img: ImageBuffer<Rgba<u8>, Vec<u8>> = ImageBuffer::new(width, height);
    for y in 0..height {
        for x in 0..width {
            let idx = ((y * width + x) * 4) as usize;
            let b = bgra_pixels[idx];
            let g = bgra_pixels[idx + 1];
            let r = bgra_pixels[idx + 2];
            let a = if has_non_zero_alpha {
                bgra_pixels[idx + 3]
            } else {
                // If the icon bitmap didn't specify an alpha channel, treat solid pixels as 255
                if r == 0 && g == 0 && b == 0 {
                    0
                } else {
                    255
                }
            };
            rgba_img.put_pixel(x, y, Rgba([r, g, b, a]));
        }
    }

    // Encode to in-memory PNG
    let mut png_bytes = Cursor::new(Vec::new());
    if rgba_img.write_to(&mut png_bytes, ImageFormat::Png).is_err() {
        return None;
    }

    let b64 = base64_encode(png_bytes.get_ref());
    Some(format!("data:image/png;base64,{b64}"))
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

struct TrackerState {
    event_tx: std::sync::mpsc::Sender<usize>,
}

static TRACKER_STATE: Mutex<Option<TrackerState>> = Mutex::new(None);

pub fn start_tracking(handle: tauri::AppHandle, tracker: Arc<AppTracker>) {
    let (tx, rx) = std::sync::mpsc::channel::<usize>();
    {
        let mut state = TRACKER_STATE.lock().unwrap();
        *state = Some(TrackerState {
            event_tx: tx,
        });
    }

    // Dedicated single background worker:
    // Guarantees FIFO order, drains intermediate Alt-Tab hops, and never drops foreground switches.
    let tracker_worker = tracker.clone();
    let handle_worker = handle.clone();
    std::thread::spawn(move || {
        while let Ok(hwnd_val) = rx.recv() {
            // Drain any pending rapid events (e.g. fast Alt-Tab or transient shell hops)
            let mut latest_hwnd_val = hwnd_val;
            while let Ok(newer) = rx.try_recv() {
                latest_hwnd_val = newer;
            }

            let hwnd = HWND(latest_hwnd_val as *mut _);
            if let Some(app_info) = tracker_worker.resolve_app_for_hwnd_checked(hwnd) {
                let _ = handle_worker.emit("foreground_app_changed", &app_info);
            }
        }
    });

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
        if let Ok(lock) = TRACKER_STATE.lock() {
            if let Some(state) = lock.as_ref() {
                let _ = state.event_tx.send(hwnd.0 as usize);
            }
        }
    }
}
