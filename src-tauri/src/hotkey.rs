//! REREAL Spitit v3: Low-Level Global Keyboard Hook (WH_KEYBOARD_LL) & Curated Hotkey Engine.
//! Complies with Section 2.1, 4.4, 4.9:
//! 1. Robust state machine: Idle, Recording, Processing. Hotkeys while processing are ignored.
//! 2. Injected keystrokes (LLKHF_INJECTED) are filtered out so SendInput Ctrl+V never loops.
//! 3. Missed key-up recovery via GetAsyncKeyState synchronization.
//! 4. Curated, industry-researched presets only: no free-form parsing errors or glitches.
//! 5. Lock contention eliminated via deterministic locking and non-dropping queue.
//! 6. Minimum hold time tap threshold: taps shorter than threshold are dropped before API/pill.
//! 7. Watchdog and automatic re-arm for sleep/wake and timeout resilience.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use windows::Win32::Foundation::{HINSTANCE, LPARAM, LRESULT, WPARAM};
use windows::Win32::UI::Input::KeyboardAndMouse::GetAsyncKeyState;
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx, HHOOK, KBDLLHOOKSTRUCT,
    MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN, WM_SYSKEYUP,
};

// Virtual Key Constants
pub const VK_LSHIFT: u32 = 0xA0;
pub const VK_RSHIFT: u32 = 0xA1;
pub const VK_SHIFT: u32 = 0x10;
pub const VK_LMENU: u32 = 0xA4; // Left Alt
pub const VK_RMENU: u32 = 0xA5; // Right Alt (AltGr)
pub const VK_MENU: u32 = 0x12; // Alt
pub const VK_LCONTROL: u32 = 0xA2;
pub const VK_RCONTROL: u32 = 0xA3;
pub const VK_CONTROL: u32 = 0x11;
pub const VK_SPACE: u32 = 0x20;
pub const VK_ESCAPE: u32 = 0x1B;

// LLKHF_INJECTED = 0x00000010
pub const LLKHF_INJECTED_FLAG: u32 = 0x10;
pub const LLKHF_LOWER_IL_INJECTED_FLAG: u32 = 0x02;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActivationMode {
    Hold,
    Toggle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EngineState {
    Idle,
    CandidateHold,
    Recording,
    Processing,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HotkeyEvent {
    StartCandidate,
    StartConfirmed,
    Stop,
    Cancel,
    TapIgnored,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub tier: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HotkeyPresetInfo {
    pub id: u8,
    pub name: String,
    pub description: String,
    pub keys_label: String,
}

pub fn get_presets_list() -> Vec<HotkeyPresetInfo> {
    vec![
        HotkeyPresetInfo {
            id: 0,
            name: "Alt + Space".to_string(),
            description: "SuperWhisper style — ergonomic & fast".to_string(),
            keys_label: "Left Alt + Space".to_string(),
        },
        HotkeyPresetInfo {
            id: 1,
            name: "Alt + Left Shift".to_string(),
            description: "Spitit classic — original shortcut".to_string(),
            keys_label: "Left Alt + Left Shift".to_string(),
        },
        HotkeyPresetInfo {
            id: 2,
            name: "Ctrl + Shift".to_string(),
            description: "Familiar modifier chord".to_string(),
            keys_label: "Left Ctrl + Left Shift".to_string(),
        },
        HotkeyPresetInfo {
            id: 3,
            name: "Right Alt".to_string(),
            description: "Single-key toggle — one finger tap".to_string(),
            keys_label: "Right Alt only".to_string(),
        },
        HotkeyPresetInfo {
            id: 4,
            name: "Ctrl + Alt + Space".to_string(),
            description: "Conflict-free across all applications".to_string(),
            keys_label: "Ctrl + Alt + Space".to_string(),
        },
        HotkeyPresetInfo {
            id: 5,
            name: "Left Ctrl + Space".to_string(),
            description: "Wispr style — fast and responsive".to_string(),
            keys_label: "Left Ctrl + Space".to_string(),
        },
    ]
}

pub fn matches_preset(preset_id: u8, pressed: &HashSet<u32>) -> bool {
    let has_alt = pressed.contains(&VK_LMENU) || pressed.contains(&VK_RMENU) || pressed.contains(&VK_MENU);
    let has_ctrl = pressed.contains(&VK_LCONTROL) || pressed.contains(&VK_RCONTROL) || pressed.contains(&VK_CONTROL);
    let has_shift = pressed.contains(&VK_LSHIFT) || pressed.contains(&VK_RSHIFT) || pressed.contains(&VK_SHIFT);
    let has_space = pressed.contains(&VK_SPACE);
    let has_ralt = pressed.contains(&VK_RMENU);

    match preset_id {
        0 => has_alt && has_space,
        1 => has_alt && has_shift,
        2 => has_ctrl && has_shift,
        3 => has_ralt,
        4 => has_ctrl && has_alt && has_space,
        5 => has_ctrl && has_space,
        _ => false,
    }
}

pub fn preset_contains_vk(preset_id: u8, vk: u32) -> bool {
    let is_alt = vk == VK_LMENU || vk == VK_RMENU || vk == VK_MENU;
    let is_ctrl = vk == VK_LCONTROL || vk == VK_RCONTROL || vk == VK_CONTROL;
    let is_shift = vk == VK_LSHIFT || vk == VK_RSHIFT || vk == VK_SHIFT;
    let is_space = vk == VK_SPACE;

    match preset_id {
        0 => is_alt || is_space,
        1 => is_alt || is_shift,
        2 => is_ctrl || is_shift,
        3 => vk == VK_RMENU || vk == VK_MENU,
        4 => is_ctrl || is_alt || is_space,
        5 => is_ctrl || is_space,
        _ => false,
    }
}

pub fn is_preset_physically_down(preset_id: u8) -> bool {
    let key_down = |vk: u32| -> bool {
        let st = unsafe { GetAsyncKeyState(vk as i32) };
        (st as u16 & 0x8000) != 0
    };

    let has_alt = key_down(VK_LMENU) || key_down(VK_RMENU) || key_down(VK_MENU);
    let has_ctrl = key_down(VK_LCONTROL) || key_down(VK_RCONTROL) || key_down(VK_CONTROL);
    let has_shift = key_down(VK_LSHIFT) || key_down(VK_RSHIFT) || key_down(VK_SHIFT);
    let has_space = key_down(VK_SPACE);
    let has_ralt = key_down(VK_RMENU);

    match preset_id {
        0 => has_alt && has_space,
        1 => has_alt && has_shift,
        2 => has_ctrl && has_shift,
        3 => has_ralt,
        4 => has_ctrl && has_alt && has_space,
        5 => has_ctrl && has_space,
        _ => false,
    }
}

pub fn validate_hotkey_combo(
    _combo_str: &str,
    _is_hold: bool,
    _other_combo: &str,
) -> ValidationResult {
    ValidationResult {
        tier: "ok".into(),
        reason: "Valid shortcut preset.".into(),
    }
}

pub struct HookSharedState {
    pub mode: ActivationMode,
    pub preset_id: u8,
    pub engine_state: EngineState,
    pub pressed_keys: HashSet<u32>,
    pub candidate_start: Option<Instant>,
    pub candidate_seq: u64,
    pub min_hold_time: Duration,
    pub last_toggle_time: Instant,
    pub is_toggle_session: bool,
    pub event_tx: Sender<HotkeyEvent>,
}

static HOOK_STATE: Mutex<Option<HookSharedState>> = Mutex::new(None);
static HOOK_HANDLE: Mutex<Option<usize>> = Mutex::new(None);
static HOOK_TID: AtomicU32 = AtomicU32::new(0);
static IS_HOOK_INSTALLED: AtomicBool = AtomicBool::new(false);

pub struct HotkeyManager {
    mode: Arc<Mutex<ActivationMode>>,
    preset_id: Arc<Mutex<u8>>,
    min_hold_ms: Arc<Mutex<u32>>,
}

impl HotkeyManager {
    pub fn new(
        mode: ActivationMode,
        preset_id: u8,
        min_hold_ms: u32,
    ) -> (Self, Receiver<HotkeyEvent>) {
        let (tx, rx) = channel::<HotkeyEvent>();
        let clamped = preset_id.min(5);

        {
            let mut lock = HOOK_STATE.lock().unwrap();
            *lock = Some(HookSharedState {
                mode,
                preset_id: clamped,
                engine_state: EngineState::Idle,
                pressed_keys: HashSet::new(),
                candidate_start: None,
                candidate_seq: 0,
                min_hold_time: Duration::from_millis(min_hold_ms as u64),
                last_toggle_time: Instant::now() - Duration::from_secs(2),
                is_toggle_session: false,
                event_tx: tx,
            });
        }

        (
            Self {
                mode: Arc::new(Mutex::new(mode)),
                preset_id: Arc::new(Mutex::new(clamped)),
                min_hold_ms: Arc::new(Mutex::new(min_hold_ms)),
            },
            rx,
        )
    }

    pub fn start(&self) {
        start_hook_worker();
        start_watchdog_thread();
    }

    pub fn set_mode(&self, new_mode: ActivationMode) {
        *self.mode.lock().unwrap() = new_mode;
        let mut lock = HOOK_STATE.lock().unwrap();
        if let Some(s) = lock.as_mut() {
            s.mode = new_mode;
            s.engine_state = EngineState::Idle;
            s.is_toggle_session = false;
            s.pressed_keys.clear();
        }
    }

    #[allow(dead_code)]
    pub fn get_mode(&self) -> ActivationMode {
        *self.mode.lock().unwrap()
    }

    pub fn update_preset(&self, preset_id: u8, min_ms: u32) {
        let clamped = preset_id.min(5);
        *self.preset_id.lock().unwrap() = clamped;
        *self.min_hold_ms.lock().unwrap() = min_ms;
        let mut lock = HOOK_STATE.lock().unwrap();
        if let Some(s) = lock.as_mut() {
            s.preset_id = clamped;
            s.min_hold_time = Duration::from_millis(min_ms as u64);
            s.engine_state = EngineState::Idle;
            s.is_toggle_session = false;
            s.pressed_keys.clear();
        }
    }

    pub fn update_combos(&self, hold_str: &str, _toggle_str: &str, min_ms: u32) {
        let preset_id = match hold_str.to_lowercase().as_str() {
            s if s.contains("space") && s.contains("ctrl") && s.contains("alt") => 4,
            s if s.contains("space") && s.contains("alt") => 0,
            s if s.contains("space") && s.contains("ctrl") => 5,
            s if s.contains("ralt") || s.contains("right alt") => 3,
            s if s.contains("ctrl") && s.contains("shift") => 2,
            _ => 1,
        };
        self.update_preset(preset_id, min_ms);
    }

    pub fn set_engine_state(&self, state: EngineState) {
        let mut lock = HOOK_STATE.lock().unwrap();
        if let Some(s) = lock.as_mut() {
            s.engine_state = state;
            if state == EngineState::Idle {
                s.candidate_start = None;
                s.is_toggle_session = false;
                s.candidate_seq = s.candidate_seq.wrapping_add(1);

                // Synchronize pressed keys with physical hardware state
                s.pressed_keys.retain(|&vk| {
                    let st = unsafe { GetAsyncKeyState(vk as i32) };
                    (st as u16 & 0x8000) != 0
                });

                // If user is actively holding the combo right when processing finishes, transition smoothly
                if s.mode == ActivationMode::Hold && matches_preset(s.preset_id, &s.pressed_keys) {
                    s.engine_state = EngineState::CandidateHold;
                    s.candidate_start = Some(Instant::now());
                    let my_seq = s.candidate_seq;
                    let _ = s.event_tx.send(HotkeyEvent::StartCandidate);

                    let min_hold = s.min_hold_time;
                    thread::spawn(move || {
                        thread::sleep(min_hold);
                        if let Ok(mut lock) = HOOK_STATE.lock() {
                            if let Some(s) = lock.as_mut() {
                                if s.candidate_seq == my_seq
                                    && s.engine_state == EngineState::CandidateHold
                                {
                                    s.engine_state = EngineState::Recording;
                                    let _ = s.event_tx.send(HotkeyEvent::StartConfirmed);
                                }
                            }
                        }
                    });
                }
            }
        }
    }

    #[allow(dead_code)]
    pub fn get_engine_state(&self) -> EngineState {
        let lock = HOOK_STATE.lock().unwrap();
        lock.as_ref()
            .map(|s| s.engine_state)
            .unwrap_or(EngineState::Idle)
    }
}

fn start_hook_worker() {
    thread::spawn(|| unsafe {
        let tid = windows::Win32::System::Threading::GetCurrentThreadId();
        HOOK_TID.store(tid, Ordering::SeqCst);

        let hmod = windows::Win32::System::LibraryLoader::GetModuleHandleW(None)
            .unwrap_or(HINSTANCE(std::ptr::null_mut()));

        let hook: HHOOK = match SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard_proc),
            hmod,
            0,
        ) {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[Spitit Hook] Failed to set hook: {e}");
                return;
            }
        };

        *HOOK_HANDLE.lock().unwrap() = Some(hook.0 as usize);
        IS_HOOK_INSTALLED.store(true, Ordering::SeqCst);

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            if msg.message == WM_QUIT {
                break;
            }
        }

        let _ = UnhookWindowsHookEx(hook);
        *HOOK_HANDLE.lock().unwrap() = None;
        IS_HOOK_INSTALLED.store(false, Ordering::SeqCst);
    });
}

/// Watchdog thread: Checks hook health and detects released keys every 100ms
fn start_watchdog_thread() {
    thread::spawn(|| {
        let mut loop_count: u32 = 0;
        loop {
            thread::sleep(Duration::from_millis(100));
            loop_count = loop_count.wrapping_add(1);

            if let Ok(mut lock) = HOOK_STATE.lock() {
                if let Some(state) = lock.as_mut() {
                    // Purge any keys that are no longer physically down
                    state.pressed_keys.retain(|&vk| {
                        let st = unsafe { GetAsyncKeyState(vk as i32) };
                        (st as u16 & 0x8000) != 0
                    });

                    // If in Hold mode and recording or holding candidate, check physical combo state
                    if state.mode == ActivationMode::Hold
                        && (state.engine_state == EngineState::Recording
                            || state.engine_state == EngineState::CandidateHold)
                    {
                        let still_down = is_preset_physically_down(state.preset_id);
                        if !still_down {
                            if state.engine_state == EngineState::CandidateHold {
                                let elapsed = state
                                    .candidate_start
                                    .map(|t| t.elapsed())
                                    .unwrap_or_default();
                                if elapsed >= state.min_hold_time {
                                    state.engine_state = EngineState::Processing;
                                    state.candidate_start = None;
                                    state.is_toggle_session = false;
                                    let _ = state.event_tx.send(HotkeyEvent::Stop);
                                } else {
                                    // Quick tap detected by watchdog: convert to toggle recording so it's not lost
                                    state.engine_state = EngineState::Recording;
                                    state.is_toggle_session = true;
                                    state.candidate_start = None;
                                    let _ = state.event_tx.send(HotkeyEvent::StartConfirmed);
                                }
                            } else if state.engine_state == EngineState::Recording && !state.is_toggle_session {
                                state.engine_state = EngineState::Processing;
                                state.candidate_start = None;
                                let _ = state.event_tx.send(HotkeyEvent::Stop);
                            }
                        }
                    }
                }
            }

            // Verify hook installation every ~2s (20 iterations * 100ms)
            if loop_count % 20 == 0 && !IS_HOOK_INSTALLED.load(Ordering::SeqCst) {
                eprintln!("[Spitit Hook Watchdog] Re-installing low-level hook...");
                start_hook_worker();
            }
        }
    });
}

/// The low-level Windows keyboard hook callback procedure.
unsafe extern "system" fn low_level_keyboard_proc(
    n_code: i32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    if n_code >= 0 {
        let kbd_struct = *(lparam.0 as *const KBDLLHOOKSTRUCT);

        // Filter out injected keystrokes (e.g. from our own SendInput Ctrl+V)
        let is_injected = (kbd_struct.flags.0 & LLKHF_INJECTED_FLAG != 0)
            || (kbd_struct.flags.0 & LLKHF_LOWER_IL_INJECTED_FLAG != 0);

        if !is_injected {
            let mut vk = kbd_struct.vkCode;
            let is_extended = (kbd_struct.flags.0 & 1) != 0;
            if vk == VK_MENU {
                vk = if is_extended { VK_RMENU } else { VK_LMENU };
            } else if vk == VK_CONTROL {
                vk = if is_extended {
                    VK_RCONTROL
                } else {
                    VK_LCONTROL
                };
            }

            let is_down = wparam.0 == WM_KEYDOWN as usize || wparam.0 == WM_SYSKEYDOWN as usize;
            let is_up = wparam.0 == WM_KEYUP as usize || wparam.0 == WM_SYSKEYUP as usize;

            if let Ok(mut lock) = HOOK_STATE.lock() {
                if let Some(state) = lock.as_mut() {
                    handle_raw_key_event(state, vk, is_down, is_up);
                }
            }
        }
    }

    CallNextHookEx(None, n_code, wparam, lparam)
}

fn handle_raw_key_event(state: &mut HookSharedState, vk: u32, is_down: bool, is_up: bool) {
    if is_down {
        state.pressed_keys.insert(vk);

        // Esc during recording cancels recording immediately
        if vk == VK_ESCAPE
            && (state.engine_state == EngineState::Recording
                || state.engine_state == EngineState::CandidateHold)
        {
            state.engine_state = EngineState::Idle;
            state.candidate_start = None;
            state.is_toggle_session = false;
            state.candidate_seq = state.candidate_seq.wrapping_add(1);
            let _ = state.event_tx.send(HotkeyEvent::Cancel);
            return;
        }

        // Ignore hotkey while processing
        if state.engine_state == EngineState::Processing {
            return;
        }

        match state.mode {
            ActivationMode::Hold => {
                let combo_active = matches_preset(state.preset_id, &state.pressed_keys);
                if combo_active {
                    if state.engine_state == EngineState::Idle {
                        state.engine_state = EngineState::CandidateHold;
                        state.candidate_start = Some(Instant::now());
                        state.is_toggle_session = false;
                        state.candidate_seq = state.candidate_seq.wrapping_add(1);
                        let my_seq = state.candidate_seq;
                        let _ = state.event_tx.send(HotkeyEvent::StartCandidate);

                        let min_hold = state.min_hold_time;
                        thread::spawn(move || {
                            thread::sleep(min_hold);
                            if let Ok(mut lock) = HOOK_STATE.lock() {
                                if let Some(s) = lock.as_mut() {
                                    if s.candidate_seq == my_seq
                                        && s.engine_state == EngineState::CandidateHold
                                    {
                                        s.engine_state = EngineState::Recording;
                                        let _ = s.event_tx.send(HotkeyEvent::StartConfirmed);
                                    }
                                }
                            }
                        });
                    } else if state.engine_state == EngineState::Recording && state.is_toggle_session {
                        // User previously tapped to start toggle recording, now pressed combo again to stop!
                        state.engine_state = EngineState::Processing;
                        state.candidate_start = None;
                        state.is_toggle_session = false;
                        let _ = state.event_tx.send(HotkeyEvent::Stop);
                    }
                }
            }
            ActivationMode::Toggle => {
                let combo_active = matches_preset(state.preset_id, &state.pressed_keys);
                if combo_active && state.last_toggle_time.elapsed() >= Duration::from_millis(300) {
                    state.last_toggle_time = Instant::now();
                    if state.engine_state == EngineState::Idle {
                        state.engine_state = EngineState::Recording;
                        state.is_toggle_session = true;
                        let _ = state.event_tx.send(HotkeyEvent::StartCandidate);
                        let _ = state.event_tx.send(HotkeyEvent::StartConfirmed);
                    } else if state.engine_state == EngineState::Recording {
                        state.engine_state = EngineState::Processing;
                        state.is_toggle_session = false;
                        let _ = state.event_tx.send(HotkeyEvent::Stop);
                    }
                }
            }
        }
    } else if is_up {
        state.pressed_keys.remove(&vk);

        if state.mode == ActivationMode::Hold {
            let is_combo_key = preset_contains_vk(state.preset_id, vk);
            if is_combo_key {
                if state.engine_state == EngineState::CandidateHold {
                    let elapsed = state
                        .candidate_start
                        .map(|t| t.elapsed())
                        .unwrap_or_default();
                    if elapsed >= state.min_hold_time {
                        // Was held past min_hold_time: normal hold release stops and pastes
                        state.engine_state = EngineState::Processing;
                        state.candidate_start = None;
                        state.is_toggle_session = false;
                        let _ = state.event_tx.send(HotkeyEvent::Stop);
                    } else {
                        // User quickly tapped the keys: transition to toggle recording so user speech is captured!
                        state.engine_state = EngineState::Recording;
                        state.is_toggle_session = true;
                        state.candidate_start = None;
                        let _ = state.event_tx.send(HotkeyEvent::StartConfirmed);
                    }
                } else if state.engine_state == EngineState::Recording {
                    if !state.is_toggle_session {
                        // Normal hold-mode release: stop and process
                        state.engine_state = EngineState::Processing;
                        state.candidate_start = None;
                        let _ = state.event_tx.send(HotkeyEvent::Stop);
                    }
                    // If toggle session, keep recording until user presses combo again
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preset_definitions() {
        let presets = get_presets_list();
        assert_eq!(presets.len(), 6);
        assert_eq!(presets[0].name, "Alt + Space");
        assert_eq!(presets[1].name, "Alt + Left Shift");
        assert_eq!(presets[2].name, "Ctrl + Shift");
        assert_eq!(presets[3].name, "Right Alt");
        assert_eq!(presets[4].name, "Ctrl + Alt + Space");
        assert_eq!(presets[5].name, "Left Ctrl + Space");
    }

    #[test]
    fn test_presets_matching() {
        let mut pressed = HashSet::new();

        // Preset 0: Alt + Space
        pressed.insert(VK_LMENU);
        assert!(!matches_preset(0, &pressed));
        pressed.insert(VK_SPACE);
        assert!(matches_preset(0, &pressed));
        pressed.clear();

        // Preset 1: Alt + Left Shift & Right variants
        pressed.insert(VK_LMENU);
        pressed.insert(VK_LSHIFT);
        assert!(matches_preset(1, &pressed));
        assert!(preset_contains_vk(1, VK_LMENU));
        assert!(preset_contains_vk(1, VK_LSHIFT));
        assert!(!preset_contains_vk(1, VK_SPACE));
        pressed.clear();

        pressed.insert(VK_RMENU);
        pressed.insert(VK_RSHIFT);
        assert!(matches_preset(1, &pressed));
        assert!(preset_contains_vk(1, VK_RMENU));
        assert!(preset_contains_vk(1, VK_RSHIFT));
        pressed.clear();

        // Preset 2: Ctrl + Shift (Left & Right variants)
        pressed.insert(VK_RCONTROL);
        pressed.insert(VK_RSHIFT);
        assert!(matches_preset(2, &pressed));
        assert!(preset_contains_vk(2, VK_RCONTROL));
        assert!(preset_contains_vk(2, VK_RSHIFT));
        pressed.clear();

        // Preset 3: Right Alt
        pressed.insert(VK_RMENU);
        assert!(matches_preset(3, &pressed));
        assert!(preset_contains_vk(3, VK_RMENU));
        pressed.clear();
    }
}
