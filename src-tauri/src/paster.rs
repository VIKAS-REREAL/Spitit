//! REREAL Spitit v3: Output Paster & Clipboard Manager.
//! Complies with Section 3.9, 4.7:
//! 1. Transcript is copied to clipboard and stays there (no fragile restore).
//! 2. Win+V clipboard history is preserved.
//! 3. Waits until physical modifier keys (Alt, Shift, Ctrl, Win) are fully released before SendInput Ctrl+V.
//! 4. Validates target window and detects elevated/admin windows with clear feedback.

use std::thread::sleep;
use std::time::{Duration, Instant};
use windows::Win32::Foundation::{CloseHandle, HANDLE, HWND};
use windows::Win32::Security::{GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
use windows::Win32::System::Threading::{
    GetCurrentProcess, OpenProcess, OpenProcessToken, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    KEYEVENTF_KEYUP, VK_CONTROL, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN, VK_MENU, VK_RCONTROL,
    VK_RMENU, VK_RSHIFT, VK_RWIN, VK_SHIFT, VK_V,
};
use windows::Win32::UI::WindowsAndMessaging::{
    BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, IsWindow, SetForegroundWindow,
};

/// Paste the transcribed text into the target window, respecting settings.
pub fn paste_text(text: &str, target_hwnd_val: isize, auto_paste: bool) -> Result<(), String> {
    if text.is_empty() {
        return Ok(());
    }

    // 1. Copy to clipboard (transcript stays in clipboard per locked decision 4.7)
    let mut clipboard =
        arboard::Clipboard::new().map_err(|e| format!("Failed to access clipboard: {e}"))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard text: {e}"))?;

    // If auto_paste is disabled, text remains in clipboard only
    if !auto_paste {
        return Ok(());
    }

    // 2. Wait for physical modifier keys to be released so SendInput isn't corrupted
    wait_for_modifiers_release();

    // 3. Ensure target window is in foreground
    let target_hwnd = HWND(target_hwnd_val as *mut _);
    if unsafe { IsWindow(target_hwnd).as_bool() } {
        let current_fg = unsafe { GetForegroundWindow() };
        if current_fg != target_hwnd {
            unsafe {
                show_window_activate(target_hwnd);
                let _ = BringWindowToTop(target_hwnd);
                let _ = SetForegroundWindow(target_hwnd);
            }
            sleep(Duration::from_millis(40));
        }

        // Check if target window is elevated
        if is_window_elevated(target_hwnd) && !is_current_process_elevated() {
            return Err("ERR_ELEVATED: Spitit cannot auto-paste into an Administrator/Elevated window. Your dictation has been copied to clipboard — press Ctrl+V manually.".into());
        }
    }

    // 4. Settle delay
    sleep(Duration::from_millis(50));

    // 5. Simulate Ctrl+V
    send_ctrl_v()?;

    Ok(())
}

unsafe fn show_window_activate(hwnd: HWND) {
    use windows::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_SHOW};
    let _ = ShowWindow(hwnd, SW_SHOW);
}

/// Waits for physical modifier keys (Alt, Shift, Ctrl, Win) to be released by the user.
/// Times out after 450ms to prevent hanging if a key state is desynced.
pub fn wait_for_modifiers_release() {
    let start = Instant::now();
    let max_wait = Duration::from_millis(450);

    let modifiers = [
        VK_MENU.0 as i32,
        VK_LMENU.0 as i32,
        VK_RMENU.0 as i32,
        VK_SHIFT.0 as i32,
        VK_LSHIFT.0 as i32,
        VK_RSHIFT.0 as i32,
        VK_CONTROL.0 as i32,
        VK_LCONTROL.0 as i32,
        VK_RCONTROL.0 as i32,
        VK_LWIN.0 as i32,
        VK_RWIN.0 as i32,
    ];

    while start.elapsed() < max_wait {
        let mut any_down = false;
        for &vk in &modifiers {
            let state = unsafe { GetAsyncKeyState(vk) };
            if (state as u16 & 0x8000) != 0 {
                any_down = true;
                break;
            }
        }
        if !any_down {
            break;
        }
        sleep(Duration::from_millis(15));
    }

    // Additional settling to allow Windows to clear internal modifier flags
    sleep(Duration::from_millis(25));
}

/// Checks if a window belongs to an elevated (Administrator) process.
fn is_window_elevated(hwnd: HWND) -> bool {
    unsafe {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return false;
        }

        let process_res = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        let process_handle = match process_res {
            Ok(h) => h,
            Err(_) => return false,
        };

        let mut token = HANDLE(std::ptr::null_mut());
        let token_res = OpenProcessToken(process_handle, TOKEN_QUERY, &mut token);
        let _ = CloseHandle(process_handle);

        if token_res.is_err() || token.0.is_null() {
            return false;
        }

        let mut elevation = TOKEN_ELEVATION::default();
        let mut ret_len = 0u32;
        let get_res = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut ret_len,
        );
        let _ = CloseHandle(token);

        get_res.is_ok() && elevation.TokenIsElevated != 0
    }
}

/// Checks if Spitit itself is running with elevated privileges.
fn is_current_process_elevated() -> bool {
    unsafe {
        let mut token = HANDLE(std::ptr::null_mut());
        if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
            return false;
        }
        let mut elevation = TOKEN_ELEVATION::default();
        let mut ret_len = 0u32;
        let res = GetTokenInformation(
            token,
            TokenElevation,
            Some(&mut elevation as *mut _ as *mut _),
            std::mem::size_of::<TOKEN_ELEVATION>() as u32,
            &mut ret_len,
        );
        let _ = CloseHandle(token);
        res.is_ok() && elevation.TokenIsElevated != 0
    }
}

fn send_ctrl_v() -> Result<(), String> {
    unsafe {
        let inputs = [
            create_key_input(VK_CONTROL.0, 0),
            create_key_input(VK_V.0, 0),
            create_key_input(VK_V.0, KEYEVENTF_KEYUP.0),
            create_key_input(VK_CONTROL.0, KEYEVENTF_KEYUP.0),
        ];

        let sent = SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);

        if sent == inputs.len() as u32 {
            Ok(())
        } else {
            Err("Failed to send keyboard input events".into())
        }
    }
}

fn create_key_input(vk: u16, flags: u32) -> INPUT {
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(vk),
                wScan: 0,
                dwFlags: KEYBD_EVENT_FLAGS(flags),
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}
