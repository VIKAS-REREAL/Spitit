//! REREAL Spitit v3: Low-Level Global Keyboard Hook (WH_KEYBOARD_LL) & Hotkey Engine.
//! Complies with Section 2.1, 4.4, 4.9:
//! 1. Robust state machine: Idle, Recording, Processing. Hotkeys while processing are ignored.
//! 2. Injected keystrokes (LLKHF_INJECTED) are filtered out so SendInput Ctrl+V never loops.
//! 3. Missed key-up recovery via GetAsyncKeyState synchronization.
//! 4. Three-tier validation (Blocked, Warning, OK) for arbitrary custom combos.
//! 5. Separate combos for Hold and Toggle modes.
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
    CallNextHookEx, GetMessageW, SetWindowsHookExW, UnhookWindowsHookEx,
    HHOOK, KBDLLHOOKSTRUCT, MSG, WH_KEYBOARD_LL, WM_KEYDOWN, WM_KEYUP, WM_QUIT, WM_SYSKEYDOWN,
    WM_SYSKEYUP,
};

// Virtual Key Constants
pub const VK_LSHIFT: u32 = 0xA0;
pub const VK_RSHIFT: u32 = 0xA1;
pub const VK_SHIFT: u32 = 0x10;
pub const VK_LMENU: u32 = 0xA4; // Left Alt
pub const VK_RMENU: u32 = 0xA5; // Right Alt (AltGr)
pub const VK_MENU: u32 = 0x12;  // Alt
pub const VK_LCONTROL: u32 = 0xA2;
pub const VK_RCONTROL: u32 = 0xA3;
pub const VK_CONTROL: u32 = 0x11;
pub const VK_LWIN: u32 = 0x5B;
pub const VK_RWIN: u32 = 0x5C;
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
    pub tier: String, // "blocked" | "warning" | "ok"
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct ParsedKeyCombo {
    #[allow(dead_code)]
    pub raw_str: String,
    pub vks: Vec<u32>,
}

impl ParsedKeyCombo {
    pub fn parse(s: &str) -> Self {
        let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
        let mut vks = Vec::new();
        for p in parts {
            let p_lower = p.to_lowercase();
            match p_lower.as_str() {
                "alt" | "lmenu" | "left alt" | "leftalt" | "altleft" => vks.push(VK_LMENU),
                "right alt" | "ralt" | "altgr" | "rmenu" | "altright" | "rightalt" => vks.push(VK_RMENU),
                "shift" | "lshift" | "left shift" | "leftshift" | "shiftleft" => vks.push(VK_LSHIFT),
                "right shift" | "rshift" | "rightshift" | "shiftright" => vks.push(VK_RSHIFT),
                "ctrl" | "control" | "lctrl" | "lcontrol" | "left ctrl" | "left control" | "controlleft" => vks.push(VK_LCONTROL),
                "right ctrl" | "rctrl" | "rcontrol" | "right control" | "controlright" => vks.push(VK_RCONTROL),
                "win" | "windows" | "lwin" => vks.push(VK_LWIN),
                "right win" | "rwin" => vks.push(VK_RWIN),
                "space" | "spacebar" => vks.push(VK_SPACE),
                "esc" | "escape" => vks.push(VK_ESCAPE),
                "f1" => vks.push(0x70),
                "f2" => vks.push(0x71),
                "f3" => vks.push(0x72),
                "f4" => vks.push(0x73),
                "f5" => vks.push(0x74),
                "f6" => vks.push(0x75),
                "f7" => vks.push(0x76),
                "f8" => vks.push(0x77),
                "f9" => vks.push(0x78),
                "f10" => vks.push(0x79),
                "f11" => vks.push(0x7A),
                "f12" => vks.push(0x7B),
                "f13" => vks.push(0x7C),
                "f14" => vks.push(0x7D),
                "f15" => vks.push(0x7E),
                "f16" => vks.push(0x7F),
                "f17" => vks.push(0x80),
                "f18" => vks.push(0x81),
                "f19" => vks.push(0x82),
                "f20" => vks.push(0x83),
                "f21" => vks.push(0x84),
                "f22" => vks.push(0x85),
                "f23" => vks.push(0x86),
                "f24" => vks.push(0x87),
                "capslock" | "caps lock" => vks.push(0x14),
                "scrolllock" | "scroll lock" => vks.push(0x91),
                "pause" => vks.push(0x13),
                "insert" => vks.push(0x2D),
                other if other.len() == 1 => {
                    let ch = other.chars().next().unwrap().to_ascii_uppercase();
                    if ch.is_ascii_alphanumeric() {
                        vks.push(ch as u32);
                    }
                }
                _ => {}
            }
        }
        Self {
            raw_str: s.to_string(),
            vks,
        }
    }

    pub fn matches(&self, pressed: &HashSet<u32>) -> bool {
        if self.vks.is_empty() {
            return false;
        }
        for &vk in &self.vks {
            let has_key = match vk {
                VK_LMENU => {
                    pressed.contains(&VK_LMENU) || pressed.contains(&VK_MENU)
                }
                VK_RMENU => {
                    pressed.contains(&VK_RMENU)
                }
                VK_LSHIFT | VK_RSHIFT => {
                    pressed.contains(&vk) || pressed.contains(&VK_SHIFT)
                }
                VK_LCONTROL => {
                    pressed.contains(&VK_LCONTROL) || pressed.contains(&VK_CONTROL)
                }
                VK_RCONTROL => {
                    pressed.contains(&VK_RCONTROL)
                }
                _ => pressed.contains(&vk),
            };
            if !has_key {
                return false;
            }
        }
        true
    }

    pub fn contains_vk(&self, vk: u32) -> bool {
        for &v in &self.vks {
            if v == vk {
                return true;
            }
            if v == VK_LMENU && (vk == VK_MENU || vk == VK_LMENU) {
                return true;
            }
            if v == VK_RMENU && (vk == VK_MENU || vk == VK_RMENU) {
                return true;
            }
            if (v == VK_LSHIFT || v == VK_RSHIFT) && vk == VK_SHIFT {
                return true;
            }
            if v == VK_LCONTROL && (vk == VK_CONTROL || vk == VK_LCONTROL) {
                return true;
            }
            if v == VK_RCONTROL && (vk == VK_CONTROL || vk == VK_RCONTROL) {
                return true;
            }
        }
        false
    }
}

pub fn validate_hotkey_combo(combo_str: &str, _is_hold: bool, other_combo: &str) -> ValidationResult {
    let trimmed = combo_str.trim();
    let lower = trimmed.to_lowercase();
    let parts: Vec<&str> = lower.split('+').map(|p| p.trim()).collect();

    if parts.is_empty() || trimmed.is_empty() {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Hotkey cannot be empty.".into(),
        };
    }

    if parts.len() > 3 {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Maximum 3 keys allowed per combo.".into(),
        };
    }

    if lower.contains("fn") {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Fn key cannot be seen by Windows or applications.".into(),
        };
    }

    if lower == "esc" || lower == "escape" {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Escape key is reserved for cancelling dictations.".into(),
        };
    }

    // Blocked: Hold and toggle being the same
    if !other_combo.is_empty() && lower == other_combo.trim().to_lowercase() {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Hold mode and Toggle mode cannot share the exact same combo.".into(),
        };
    }

    // Windows reserved combos
    if lower.starts_with("win+") || lower.contains("+win") || lower == "win" {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Windows key combinations are reserved by the operating system.".into(),
        };
    }
    if lower == "ctrl+alt+del" || lower == "alt+tab" || lower == "alt+f4" || lower == "ctrl+shift+esc" {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Reserved Windows system shortcut.".into(),
        };
    }

    // Universal editing shortcuts
    let universal = ["ctrl+c", "ctrl+v", "ctrl+x", "ctrl+z", "ctrl+y", "ctrl+a", "ctrl+s", "ctrl+w", "ctrl+t", "ctrl+n"];
    if universal.contains(&lower.as_str()) {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Reserved universal application shortcut.".into(),
        };
    }

    // Single typing key
    let non_typing_single = [
        "right ctrl", "rctrl", "right alt", "ralt", "altgr", "capslock", "scrolllock",
        "pause", "insert", "f13", "f14", "f15", "f16", "f17", "f18", "f19", "f20", "f21", "f22", "f23", "f24"
    ];
    if parts.len() == 1 {
        let single = parts[0];
        if !non_typing_single.contains(&single) {
            return ValidationResult {
                tier: "blocked".into(),
                reason: "Single typing keys cannot be hotkeys (they would trigger while typing).".into(),
            };
        }
    }

    // Shift alone or Shift + letter/digit
    if lower == "shift" || lower == "lshift" || lower == "rshift" {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Shift alone cannot be used as a hotkey.".into(),
        };
    }
    if parts.len() == 2 && (parts[0] == "shift" || parts[0] == "lshift") && parts[1].len() == 1 {
        return ValidationResult {
            tier: "blocked".into(),
            reason: "Shift + letter/digit is used for capital letters.".into(),
        };
    }

    // Warning tier
    if lower == "alt+shift" || lower == "ctrl+shift" {
        return ValidationResult {
            tier: "warning".into(),
            reason: "Switches keyboard layout in Windows if multiple languages are installed.".into(),
        };
    }
    if lower == "right alt" || lower == "altgr" || lower == "ralt" {
        return ValidationResult {
            tier: "warning".into(),
            reason: "Acts as AltGr on European/international keyboards to type special characters.".into(),
        };
    }
    if lower == "ctrl+space" || lower == "alt+space" {
        return ValidationResult {
            tier: "warning".into(),
            reason: "May conflict with Windows system menu or IME language input switchers.".into(),
        };
    }
    if lower == "alt" || lower == "left alt" {
        return ValidationResult {
            tier: "warning".into(),
            reason: "Tapping Alt alone focuses application menu bars.".into(),
        };
    }

    ValidationResult {
        tier: "ok".into(),
        reason: "Valid shortcut combination.".into(),
    }
}

pub struct HookSharedState {
    pub mode: ActivationMode,
    pub hold_combo: ParsedKeyCombo,
    pub toggle_combo: ParsedKeyCombo,
    pub engine_state: EngineState,
    pub pressed_keys: HashSet<u32>,
    pub candidate_start: Option<Instant>,
    pub min_hold_time: Duration,
    pub last_toggle_time: Instant,
    pub event_tx: Sender<HotkeyEvent>,
}

static HOOK_STATE: Mutex<Option<HookSharedState>> = Mutex::new(None);
static HOOK_HANDLE: Mutex<Option<usize>> = Mutex::new(None);
static HOOK_TID: AtomicU32 = AtomicU32::new(0);
static IS_HOOK_INSTALLED: AtomicBool = AtomicBool::new(false);

pub struct HotkeyManager {
    mode: Arc<Mutex<ActivationMode>>,
    min_hold_ms: Arc<Mutex<u32>>,
}

impl HotkeyManager {
    pub fn new(
        mode: ActivationMode,
        hold_combo_str: &str,
        toggle_combo_str: &str,
        min_hold_ms: u32,
    ) -> (Self, Receiver<HotkeyEvent>) {
        let (tx, rx) = channel::<HotkeyEvent>();
        let hold_parsed = ParsedKeyCombo::parse(hold_combo_str);
        let toggle_parsed = ParsedKeyCombo::parse(toggle_combo_str);

        {
            let mut lock = HOOK_STATE.lock().unwrap();
            *lock = Some(HookSharedState {
                mode,
                hold_combo: hold_parsed,
                toggle_combo: toggle_parsed,
                engine_state: EngineState::Idle,
                pressed_keys: HashSet::new(),
                candidate_start: None,
                min_hold_time: Duration::from_millis(min_hold_ms as u64),
                last_toggle_time: Instant::now() - Duration::from_secs(2),
                event_tx: tx,
            });
        }

        (
            Self {
                mode: Arc::new(Mutex::new(mode)),
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
            s.pressed_keys.clear();
        }
    }

    #[allow(dead_code)]
    pub fn get_mode(&self) -> ActivationMode {
        *self.mode.lock().unwrap()
    }

    pub fn update_combos(&self, hold_str: &str, toggle_str: &str, min_ms: u32) {
        *self.min_hold_ms.lock().unwrap() = min_ms;
        let mut lock = HOOK_STATE.lock().unwrap();
        if let Some(s) = lock.as_mut() {
            s.hold_combo = ParsedKeyCombo::parse(hold_str);
            s.toggle_combo = ParsedKeyCombo::parse(toggle_str);
            s.min_hold_time = Duration::from_millis(min_ms as u64);
            s.engine_state = EngineState::Idle;
            s.pressed_keys.clear();
        }
    }

    pub fn set_engine_state(&self, state: EngineState) {
        let mut lock = HOOK_STATE.lock().unwrap();
        if let Some(s) = lock.as_mut() {
            s.engine_state = state;
            if state == EngineState::Idle {
                s.candidate_start = None;
            }
        }
    }

    #[allow(dead_code)]
    pub fn get_engine_state(&self) -> EngineState {
        let lock = HOOK_STATE.lock().unwrap();
        lock.as_ref().map(|s| s.engine_state).unwrap_or(EngineState::Idle)
    }
}

fn start_hook_worker() {
    thread::spawn(|| unsafe {
        let tid = windows::Win32::System::Threading::GetCurrentThreadId();
        HOOK_TID.store(tid, Ordering::SeqCst);

        let hook: HHOOK = match SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard_proc),
            HINSTANCE(std::ptr::null_mut()),
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

/// Watchdog thread (Section 2.1): Checks hook health every 2.5s and re-arms if removed or desynced
fn start_watchdog_thread() {
    thread::spawn(|| loop {
        thread::sleep(Duration::from_millis(2500));

        // Purge any stuck keys using GetAsyncKeyState
        if let Ok(mut lock) = HOOK_STATE.try_lock() {
            if let Some(state) = lock.as_mut() {
                state.pressed_keys.retain(|&vk| {
                    let st = unsafe { GetAsyncKeyState(vk as i32) };
                    (st as u16 & 0x8000) != 0
                });
            }
        }

        // Verify hook installation
        if !IS_HOOK_INSTALLED.load(Ordering::SeqCst) {
            eprintln!("[Spitit Hook Watchdog] Re-installing low-level hook...");
            start_hook_worker();
        }
    });
}

/// The low-level Windows keyboard hook callback procedure.
/// Sub-millisecond execution: non-blocking try_lock or minimal lock.
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
                vk = if is_extended { VK_RCONTROL } else { VK_LCONTROL };
            }

            let is_down = wparam.0 == WM_KEYDOWN as usize || wparam.0 == WM_SYSKEYDOWN as usize;
            let is_up = wparam.0 == WM_KEYUP as usize || wparam.0 == WM_SYSKEYUP as usize;

            if let Ok(mut lock) = HOOK_STATE.try_lock() {
                if let Some(state) = lock.as_mut() {
                    handle_raw_key_event(state, vk, is_down, is_up);
                }
            }
        }
    }

    // Never swallow keys: pass all events to next hook
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
            let _ = state.event_tx.send(HotkeyEvent::Cancel);
            return;
        }

        // Section 2.1: Ignore hotkey while processing
        if state.engine_state == EngineState::Processing {
            return;
        }

        match state.mode {
            ActivationMode::Hold => {
                let combo_active = state.hold_combo.matches(&state.pressed_keys);
                if combo_active {
                    if state.engine_state == EngineState::Idle {
                        state.engine_state = EngineState::CandidateHold;
                        state.candidate_start = Some(Instant::now());
                        // Open mic immediately in background (Section 4.5)
                        let _ = state.event_tx.send(HotkeyEvent::StartCandidate);

                        // Spawn background timer to confirm recording when held past tap threshold (Section 4.4)
                        let min_hold = state.min_hold_time;
                        thread::spawn(move || {
                            thread::sleep(min_hold);
                            if let Ok(mut lock) = HOOK_STATE.try_lock() {
                                if let Some(s) = lock.as_mut() {
                                    if s.engine_state == EngineState::CandidateHold {
                                        s.engine_state = EngineState::Recording;
                                        let _ = s.event_tx.send(HotkeyEvent::StartConfirmed);
                                    }
                                }
                            }
                        });
                    }
                }
            }
            ActivationMode::Toggle => {
                let combo_active = state.toggle_combo.matches(&state.pressed_keys);
                if combo_active && state.last_toggle_time.elapsed() >= Duration::from_millis(350) {
                    state.last_toggle_time = Instant::now();
                    if state.engine_state == EngineState::Idle {
                        state.engine_state = EngineState::Recording;
                        let _ = state.event_tx.send(HotkeyEvent::StartCandidate);
                        let _ = state.event_tx.send(HotkeyEvent::StartConfirmed);
                    } else if state.engine_state == EngineState::Recording {
                        state.engine_state = EngineState::Processing;
                        let _ = state.event_tx.send(HotkeyEvent::Stop);
                    }
                }
            }
        }
    } else if is_up {
        state.pressed_keys.remove(&vk);

        if state.mode == ActivationMode::Hold {
            let is_combo_key = state.hold_combo.contains_vk(vk);
            if is_combo_key {
                if state.engine_state == EngineState::CandidateHold {
                    let elapsed = state.candidate_start.map(|t| t.elapsed()).unwrap_or_default();
                    if elapsed >= state.min_hold_time {
                        // User held past threshold, just released
                        state.engine_state = EngineState::Processing;
                        state.candidate_start = None;
                        let _ = state.event_tx.send(HotkeyEvent::Stop);
                    } else {
                        // Released before minimum hold time: accidental tap!
                        state.engine_state = EngineState::Idle;
                        state.candidate_start = None;
                        let _ = state.event_tx.send(HotkeyEvent::TapIgnored);
                    }
                } else if state.engine_state == EngineState::Recording {
                    // Real hold finished: transition to processing
                    state.engine_state = EngineState::Processing;
                    state.candidate_start = None;
                    let _ = state.event_tx.send(HotkeyEvent::Stop);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validation_tiers() {
        // Blocked: single letters, digits, space
        assert_eq!(validate_hotkey_combo("a", true, "").tier, "blocked");
        assert_eq!(validate_hotkey_combo("1", true, "").tier, "blocked");
        assert_eq!(validate_hotkey_combo("space", true, "").tier, "blocked");

        // Blocked: Shift alone or Shift+letter
        assert_eq!(validate_hotkey_combo("shift", true, "").tier, "blocked");
        assert_eq!(validate_hotkey_combo("shift+k", true, "").tier, "blocked");

        // Blocked: Esc
        assert_eq!(validate_hotkey_combo("esc", true, "").tier, "blocked");

        // Blocked: Windows keys
        assert_eq!(validate_hotkey_combo("win+k", true, "").tier, "blocked");
        assert_eq!(validate_hotkey_combo("ctrl+alt+del", true, "").tier, "blocked");

        // Blocked: Universal shortcuts
        assert_eq!(validate_hotkey_combo("ctrl+c", true, "").tier, "blocked");
        assert_eq!(validate_hotkey_combo("ctrl+v", true, "").tier, "blocked");

        // Blocked: Same combo as other
        assert_eq!(validate_hotkey_combo("Alt+Shift", true, "Alt+Shift").tier, "blocked");

        // Warning: Layout switchers and AltGr
        assert_eq!(validate_hotkey_combo("alt+shift", true, "").tier, "warning");
        assert_eq!(validate_hotkey_combo("ctrl+shift", true, "").tier, "warning");
        assert_eq!(validate_hotkey_combo("right alt", true, "").tier, "warning");
        assert_eq!(validate_hotkey_combo("alt+space", true, "").tier, "warning");
        assert_eq!(validate_hotkey_combo("ctrl+space", true, "").tier, "warning");

        // OK: Valid combos
        assert_eq!(validate_hotkey_combo("ctrl+alt+space", true, "").tier, "ok");
        assert_eq!(validate_hotkey_combo("f13", true, "").tier, "ok");
        assert_eq!(validate_hotkey_combo("capslock", true, "").tier, "ok");
        assert_eq!(validate_hotkey_combo("ctrl+alt+k", true, "").tier, "ok");
    }

    #[test]
    fn test_combo_matching() {
        let combo = ParsedKeyCombo::parse("Alt+LShift");
        let mut pressed = HashSet::new();
        pressed.insert(VK_LMENU);
        assert!(!combo.matches(&pressed));

        pressed.insert(VK_LSHIFT);
        assert!(combo.matches(&pressed));

        assert!(combo.contains_vk(VK_LMENU));
        assert!(combo.contains_vk(VK_LSHIFT));
        assert!(!combo.contains_vk(VK_SPACE));
    }
}
