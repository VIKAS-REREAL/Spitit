//! REREAL Spitit v3: Low-Level Global Keyboard Hook (WH_KEYBOARD_LL).
//! Supports customizable modifier combinations, hold mode, toggle mode,
//! window-switch tolerance, and layout debouncing.

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, PostThreadMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_QUIT, WM_SYSKEYDOWN,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum ActivationMode {
    Hold,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum HotkeyCombo {
    AltShift,
    CtrlSpace,
    AltSpace,
    CtrlShift,
    RightAlt,
}

impl Default for HotkeyCombo {
    fn default() -> Self {
        HotkeyCombo::AltShift
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HotkeyEvent {
    Start,
    Stop,
    Cancel,
}

struct HookState {
    mode: ActivationMode,
    combo: HotkeyCombo,
    is_recording: bool,
    pressed_keys: HashSet<u32>,
    hold_triggered: bool,
    toggle_pressed: bool,
    last_toggle: std::time::Instant,
    event_sender: Option<std::sync::mpsc::Sender<HotkeyEvent>>,
}

impl HookState {
    fn new(
        mode: ActivationMode,
        combo: HotkeyCombo,
        tx: Option<std::sync::mpsc::Sender<HotkeyEvent>>,
    ) -> Self {
        Self {
            mode,
            combo,
            is_recording: false,
            pressed_keys: HashSet::new(),
            hold_triggered: false,
            toggle_pressed: false,
            last_toggle: std::time::Instant::now() - std::time::Duration::from_secs(1),
            event_sender: tx,
        }
    }

    fn is_combo_active(&self) -> bool {
        let alt = self.pressed_keys.contains(&VK_LMENU)
            || self.pressed_keys.contains(&VK_RMENU)
            || self.pressed_keys.contains(&VK_MENU);
        let shift = self.pressed_keys.contains(&VK_LSHIFT)
            || self.pressed_keys.contains(&VK_RSHIFT)
            || self.pressed_keys.contains(&VK_SHIFT);
        let ctrl = self.pressed_keys.contains(&VK_LCONTROL)
            || self.pressed_keys.contains(&VK_RCONTROL)
            || self.pressed_keys.contains(&VK_CONTROL);
        let space = self.pressed_keys.contains(&VK_SPACE);
        let ralt = self.pressed_keys.contains(&VK_RMENU);

        match self.combo {
            HotkeyCombo::AltShift => alt && shift,
            HotkeyCombo::CtrlSpace => ctrl && space,
            HotkeyCombo::AltSpace => alt && space,
            HotkeyCombo::CtrlShift => ctrl && shift,
            HotkeyCombo::RightAlt => ralt,
        }
    }

    fn is_key_in_combo(&self, vk: u32) -> bool {
        match self.combo {
            HotkeyCombo::AltShift => {
                vk == VK_LMENU
                    || vk == VK_RMENU
                    || vk == VK_MENU
                    || vk == VK_LSHIFT
                    || vk == VK_RSHIFT
                    || vk == VK_SHIFT
            }
            HotkeyCombo::CtrlSpace => {
                vk == VK_LCONTROL
                    || vk == VK_RCONTROL
                    || vk == VK_CONTROL
                    || vk == VK_SPACE
            }
            HotkeyCombo::AltSpace => {
                vk == VK_LMENU
                    || vk == VK_RMENU
                    || vk == VK_MENU
                    || vk == VK_SPACE
            }
            HotkeyCombo::CtrlShift => {
                vk == VK_LCONTROL
                    || vk == VK_RCONTROL
                    || vk == VK_CONTROL
                    || vk == VK_LSHIFT
                    || vk == VK_RSHIFT
                    || vk == VK_SHIFT
            }
            HotkeyCombo::RightAlt => vk == VK_RMENU,
        }
    }

    pub fn handle_key_event(&mut self, vk: u32, is_down: bool) -> Option<HotkeyEvent> {
        if is_down {
            self.pressed_keys.insert(vk);

            if vk == VK_ESCAPE && self.is_recording {
                self.is_recording = false;
                self.hold_triggered = false;
                self.toggle_pressed = false;
                return Some(HotkeyEvent::Cancel);
            }

            let combo_active = self.is_combo_active();

            match self.mode {
                ActivationMode::Hold => {
                    if combo_active && !self.hold_triggered {
                        self.hold_triggered = true;
                        self.is_recording = true;
                        return Some(HotkeyEvent::Start);
                    }
                }
                ActivationMode::Toggle => {
                    if combo_active
                        && !self.toggle_pressed
                        && self.last_toggle.elapsed() >= std::time::Duration::from_millis(300)
                    {
                        self.toggle_pressed = true;
                        self.last_toggle = std::time::Instant::now();
                        self.is_recording = !self.is_recording;
                        if self.is_recording {
                            return Some(HotkeyEvent::Start);
                        } else {
                            return Some(HotkeyEvent::Stop);
                        }
                    }
                }
            }
        } else {
            self.pressed_keys.remove(&vk);

            match self.mode {
                ActivationMode::Hold => {
                    if self.is_key_in_combo(vk) && self.hold_triggered {
                        self.hold_triggered = false;
                        self.is_recording = false;
                        return Some(HotkeyEvent::Stop);
                    }
                }
                ActivationMode::Toggle => {
                    if !self.is_combo_active() {
                        self.toggle_pressed = false;
                    }
                }
            }
        }
        None
    }
}

// Global thread-safe state for the C callback
static STATE: Mutex<Option<HookState>> = Mutex::new(None);
static HOOK_THREAD_ID: Mutex<u32> = Mutex::new(0);
static IS_RUNNING: AtomicBool = AtomicBool::new(false);

pub struct HotkeyManager {
    mode: Arc<Mutex<ActivationMode>>,
    combo: Arc<Mutex<HotkeyCombo>>,
}

impl HotkeyManager {
    pub fn new(
        mode: ActivationMode,
        combo: HotkeyCombo,
    ) -> (Self, std::sync::mpsc::Receiver<HotkeyEvent>) {
        let (tx, rx) = std::sync::mpsc::channel();
        let mode_arc = Arc::new(Mutex::new(mode));
        let combo_arc = Arc::new(Mutex::new(combo));

        {
            let mut state = STATE.lock().unwrap();
            *state = Some(HookState::new(mode, combo, Some(tx)));
        }

        (
            Self {
                mode: mode_arc,
                combo: combo_arc,
            },
            rx,
        )
    }

    pub fn start(&self) {
        if IS_RUNNING.load(Ordering::SeqCst) {
            return;
        }
        IS_RUNNING.store(true, Ordering::SeqCst);

        thread::spawn(|| unsafe {
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

    pub fn get_mode(&self) -> ActivationMode {
        *self.mode.lock().unwrap()
    }

    pub fn set_combo(&self, new_combo: HotkeyCombo) {
        *self.combo.lock().unwrap() = new_combo;
        let mut state = STATE.lock().unwrap();
        if let Some(s) = state.as_mut() {
            s.combo = new_combo;
            s.is_recording = false;
            s.hold_triggered = false;
            s.toggle_pressed = false;
        }
    }

    pub fn get_combo(&self) -> HotkeyCombo {
        *self.combo.lock().unwrap()
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

        let mut lock = STATE.lock().unwrap();
        if let Some(state) = lock.as_mut() {
            if let Some(event) = state.handle_key_event(vk, is_down) {
                if let Some(tx) = &state.event_sender {
                    let _ = tx.send(event);
                }
            }
        }
    }

    // Never swallow keys: pass all events to next hook
    CallNextHookEx(None, n_code, wparam, lparam)
}
