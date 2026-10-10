//! REREAL Spitit v3: Output handler.
//! Sets clipboard and triggers SendInput Ctrl+V to paste automatically.

use std::thread::sleep;
use std::time::Duration;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYBD_EVENT_FLAGS,
    KEYEVENTF_KEYUP, VK_CONTROL, VK_V,
};

pub fn paste_text(text: &str) -> Result<(), String> {
    // 1. Copy to clipboard
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("Failed to access clipboard: {e}"))?;
    clipboard
        .set_text(text)
        .map_err(|e| format!("Failed to set clipboard text: {e}"))?;

    // 2. Allow clipboard to settle (50ms as per Python reference)
    sleep(Duration::from_millis(50));

    // 3. Trigger Ctrl+V via SendInput
    send_ctrl_v()?;

    Ok(())
}

fn send_ctrl_v() -> Result<(), String> {
    unsafe {
        let mut inputs = [
            // Ctrl down
            create_key_input(VK_CONTROL.0, 0),
            // V down
            create_key_input(VK_V.0, 0),
            // V up
            create_key_input(VK_V.0, KEYEVENTF_KEYUP.0),
            // Ctrl up
            create_key_input(VK_CONTROL.0, KEYEVENTF_KEYUP.0),
        ];

        let sent = SendInput(
            &mut inputs,
            std::mem::size_of::<INPUT>() as i32,
        );

        if sent == inputs.len() as u32 {
            Ok(())
        } else {
            Err("Failed to send all keyboard input events".into())
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
