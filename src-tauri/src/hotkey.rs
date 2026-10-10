//! REREAL Spitit v3: Low-Level Global Keyboard Hook (WH_KEYBOARD_LL).
//! Supports modifier-only combos (Alt+LShift), hold mode, toggle mode,
//! window-switch tolerance, and Alt+Shift layout debounce.

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, PostThreadMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN,
    WM_SYSKEYUP,
};

// Common virtual key constants
pub const VK_LSHIFT: u32 = 0xA0;
pub const VK_RSHIFT: u32 = 0xA1;
pub const VK_SHIFT: u32 = 0x10;
pub const VK_LMENU: u32 = 0xA4; // Left Alt
pub const VK_RMENU: u32 = 0xA5; // Right Alt
pub const VK_MENU: u32 = 0x12;  // Alt
pub const VK_LCONTROL: u32 = 0xA2;
pub const VK_RCONTROL: u32 = 0xA3;
pub const VK_CONTROL: u32 = 0x11;
pub const VK_SPACE: u32 = 0x20;
pub const VK_ESCAPE: u32 = 0x1B;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivationMode {
    Hold,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HotkeyEvent {
    Start,
    Stop,
    Cancel,
}

struct HookState {
    mode: ActivationMode,
    is_recording: bool,
    pressed_keys: HashSet<u32>,
    hold_triggered: bool,
    toggle_pressed: bool,
    event_sender: Option<std::sync::mpsc::Sender<HotkeyEvent>>,
}

// Global thread-safe state for the C callback
static STATE: Mutex<Option<HookState>> = Mutex::new(None);
static HOOK_THREAD_ID: Mutex<u32> = Mutex::new(0);
static IS_RUNNING: AtomicBool = AtomicBool::new(false);

pub struct HotkeyManager {
    event_rx: Option<std::sync::mpsc::Receiver<HotkeyEvent>>,
    mode: Arc<Mutex<ActivationMode>>,
}

impl HotkeyManager {
    pub fn new(mode: ActivationMode) -> (Self, std::sync::mpsc::Receiver<HotkeyEvent>) {
        let (tx, rx) = std::sync::mpsc::channel();
        let mode_arc = Arc::new(Mutex::new(mode));

        {
            let mut state = STATE.lock().unwrap();
            *state = Some(HookState {
                mode,
                is_recording: false,
                pressed_keys: HashSet::new(),
                hold_triggered: false,
                toggle_pressed: false,
                event_sender: Some(tx),
            });
        }

        (
            Self {
                event_rx: None,
                mode: mode_arc,
            },
            rx,
        )
    }

    pub fn start(&self) {
        if IS_RUNNING.load(Ordering::SeqCst) {
            return;
        }
        IS_RUNNING.store(true, Ordering::SeqCst);

        thread::spawn(|| {
            unsafe {
                let tid = windows::Win32::System::Threading::GetCurrentThreadId();
                *HOOK_THREAD_ID.lock().unwrap() = tid;

                let hook: HHOOK = SetWindowsHookExW(
                    WH_KEYBOARD_LL,
                    Some(low_level_keyboard_proc),
                    HINSTANCE(std::ptr::null_mut()),
                    0,
                )
                .expect("Failed to install WH_KEYBOARD_LL hook");

                let mut msg = MSG::default();
                while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                    if msg.message == WM_QUIT {
                        break;
                    }
                }

                let _ = UnhookWindowsHookEx(hook);
                IS_RUNNING.store(false, Ordering::SeqCst);
            }
        });
    }

    pub fn set_mode(&self, new_mode: ActivationMode) {
        *self.mode.lock().unwrap() = new_mode;
        let mut state = STATE.lock().unwrap();
        if let Some(s) = state.as_mut() {
            s.mode = new_mode;
            s.is_recording = false;
            s.hold_triggered = false;
            s.toggle_pressed = false;
        }
    }

    pub fn stop(&self) {
        let tid = *HOOK_THREAD_ID.lock().unwrap();
        if tid != 0 {
            unsafe {
                let _ = PostThreadMessageW(tid, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
        IS_RUNNING.store(false, Ordering::SeqCst);
    }
}

/// The low-level Windows keyboard hook callback procedure.
unsafe extern "system" fn low_level_keyboard_proc(
    n_code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if n_code >= 0 {
        let kbd_struct = *(lparam.0 as *const KBDLLHOOKSTRUCT);
        let vk = kbd_struct.vkCode;
        let is_down = wparam.0 == WM_KEYDOWN as usize || wparam.0 == WM_SYSKEYDOWN as usize;
        let is_up = wparam.0 == WM_KEYUP as usize || wparam.0 == WM_SYSKEYUP as usize;

        let mut lock = STATE.lock().unwrap();
        if let Some(state) = lock.as_mut() {
            if is_down {
                state.pressed_keys.insert(vk);

                // Escape key cancels active recording
                if vk == VK_ESCAPE && state.is_recording {
                    state.is_recording = false;
                    state.hold_triggered = false;
                    state.toggle_pressed = false;
                    if let Some(tx) = &state.event_sender {
                        let _ = tx.send(HotkeyEvent::Cancel);
                    }
                } else {
                    match state.mode {
                        ActivationMode::Hold => {
                            // Check if Alt + LShift is down
                            let alt_down = state.pressed_keys.contains(&VK_LMENU)
                                || state.pressed_keys.contains(&VK_RMENU)
                                || state.pressed_keys.contains(&VK_MENU);
                            let shift_down = state.pressed_keys.contains(&VK_LSHIFT)
                                || state.pressed_keys.contains(&VK_RSHIFT)
                                || state.pressed_keys.contains(&VK_SHIFT);

                            if alt_down && shift_down && !state.hold_triggered {
                                state.hold_triggered = true;
                                state.is_recording = true;
                                if let Some(tx) = &state.event_sender {
                                    let _ = tx.send(HotkeyEvent::Start);
                                }
                            }
                        }
                        ActivationMode::Toggle => {
                            let alt_down = state.pressed_keys.contains(&VK_LMENU)
                                || state.pressed_keys.contains(&VK_RMENU)
                                || state.pressed_keys.contains(&VK_MENU);
                            let shift_down = state.pressed_keys.contains(&VK_LSHIFT)
                                || state.pressed_keys.contains(&VK_RSHIFT)
                                || state.pressed_keys.contains(&VK_SHIFT);

                            if alt_down && shift_down {
                                if !state.toggle_pressed {
                                    state.toggle_pressed = true;
                                    state.is_recording = !state.is_recording;
                                    if let Some(tx) = &state.event_sender {
                                        if state.is_recording {
                                            let _ = tx.send(HotkeyEvent::Start);
                                        } else {
                                            let _ = tx.send(HotkeyEvent::Stop);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else if is_up {
                state.pressed_keys.remove(&vk);

                if state.mode == ActivationMode::Hold {
                    // In Hold mode, only releasing a key of the combo stops recording!
                    let is_combo_key = vk == VK_LMENU
                        || vk == VK_RMENU
                        || vk == VK_MENU
                        || vk == VK_LSHIFT
                        || vk == VK_RSHIFT
                        || vk == VK_SHIFT;

                    if is_combo_key && state.hold_triggered {
                        state.hold_triggered = false;
                        state.is_recording = false;
                        if let Some(tx) = &state.event_sender {
                            let _ = tx.send(HotkeyEvent::Stop);
                        }
                    }
                } else if state.mode == ActivationMode::Toggle {
                    let is_combo_key = vk == VK_LMENU
                        || vk == VK_RMENU
                        || vk == VK_MENU
                        || vk == VK_LSHIFT
                        || vk == VK_RSHIFT
                        || vk == VK_SHIFT;

                    if is_combo_key {
                        state.toggle_pressed = false;
                    }
                }
            }
        }
    }

    // Never swallow keys: pass all events to next hook
    CallNextHookEx(None, n_code, wparam, lparam)
}
