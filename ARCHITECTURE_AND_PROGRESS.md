# REREAL Spitit v3 — Architecture, Context & Progress

> **Context for Antigravity & Collaborators**: This document contains the complete context, architectural blueprints, implementation status, and instructions for REREAL Spitit v3. Spitit is a high-speed, voice dictation desktop app for Windows 10 & 11 built with Tauri 2, Rust, and React 19.

---

## 1. Executive Summary & Production Stack

| Dimension | Specification |
|---|---|
| **Core Architecture** | **Tauri 2 (Rust Core + WebView2 React 19/Vite/TS UI)** |
| **Idle Resource Target** | **≤ 40 MB RAM** (Native Rust process idles at ~25 MB WS / ~5 MB Private commit), 0% CPU idle in system tray |
| **Store Packaging & Dist** | **NSIS Installer** (`Spitit_3.0.0_x64-setup.exe`) + **MSIX Ready** |
| **Audio Pipeline** | Channel-based actor model (`cpal` WASAPI 16 kHz mono) → in-memory WAV (`hound`) → Groq Whisper (`whisper-large-v3-turbo`) |
| **Silence Trimming** | Leading and trailing silence trimmed in-memory before upload; silent audio dropped before network API calls |
| **Hinglish Normalizer** | Groq Llama (`llama-3.1-8b-instant`) Roman script cleanup guidance |
| **Output Pipeline** | Win32 modifier release verification → clipboard set (`arboard`) → Win32 `SendInput` `Ctrl+V` |
| **Storage & Privacy** | Decoupled **SQLite** (`rusqlite`): `text_history` (500 cap, toggleable) + `usage_stats` (numbers only, 90-day retention) |
| **Security** | Windows Credential Manager (`keyring` crate) for Groq API Key. Zero plain-text keys on disk. |

---

## 2. Directory Structure (`D:\codevs\Spitit`)

```
D:\codevs\Spitit\
├── assets\                     # Application icons (.ico, .png, .svg) and UI assets
├── public\                     # Static web assets & chime sound files (start.wav, done.wav)
├── src\                        # React 19 + TypeScript Frontend
│   ├── components\
│   │   ├── Pill.tsx            # Display-only signature Pill Capsule (Icon, Voice Waveform, Timer)
│   │   └── Pill.css            # Rotating edge beam (@property --beam-angle), audio bars, glassmorphism
│   ├── App.tsx                 # Main application dashboard, 6-step onboarding wizard, settings, history
│   ├── App.css                 # Base theme styles (Dark mode, Brand Yellow #FFD505, validation badges)
│   ├── PillWindow.tsx          # Pill window controller, audio chimes, honest error mapping
│   └── main.tsx                # React root mount with dynamic window label routing ("pill" vs "main")
├── src-tauri\                  # Rust Backend
│   ├── src\
│   │   ├── hotkey.rs           # Low-level keyboard hook (WH_KEYBOARD_LL), watchdog, 3-tier validation
│   │   ├── recorder.rs         # Actor-model cpal WASAPI recorder, RMS level streaming, 90s cutoff
│   │   ├── transcriber.rs      # Groq Whisper turbo + Llama Hinglish cleanup & structured error codes
│   │   ├── paster.rs           # Active window targeting, modifier release wait, elevated window check
│   │   ├── credentials.rs      # Windows Credential Manager storage for Groq API key
│   │   ├── db.rs               # Decoupled SQLite database (text_history cap 500, usage_stats 90-day)
│   │   ├── settings.rs         # Persistent settings manager (settings.json in LocalAppData)
│   │   ├── app_tracker.rs      # Win32 foreground tracker, CoreWindow resolution, RGBA PNG icons
│   │   ├── lib.rs              # Tauri 2 app builder, decoupled event loop, multi-monitor DPI, IPC
│   │   └── main.rs             # Application entry point
│   ├── Cargo.toml              # Rust crate dependencies
│   ├── build.rs                # Tauri build hook
│   └── tauri.conf.json         # Tauri 2 window & bundle configuration
├── spitit-v3.exe               # Standalone production executable
├── Spitit_3.0.0_x64-setup.exe  # Production NSIS setup installer
├── package.json                # Frontend npm configuration
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration
├── SPITIT_V3_SPEC.md           # The primary specification brief (single source of truth)
├── ARCHITECTURE_AND_PROGRESS.md# This document
└── README.md                   # Project overview & quickstart
```

---

## 3. Core Architectural Implementations & Completed Features

### A. Decoupled State Machine & Reliable Hotkey Engine (`hotkey.rs`)
1. **Four-State Engine**: States are managed centrally via `EngineState`:
   - `Idle`: Listening for hotkey press.
   - `CandidateHold`: Hotkey pressed; microphone stream starts immediately, tap threshold timer ticking.
   - `Recording`: Tap threshold exceeded; pill appears, rotating edge beam spins, voice level bars activate.
   - `Processing`: Transcribing and pasting. **Hotkey presses while processing are strictly ignored**.
2. **Decoupled Worker Loop**: The hotkey event receiver runs in its own worker thread and spawns asynchronous Tokio tasks for network transcription and pasting. Network latency can never block the hotkey channel.
3. **Injected Keystroke Guard**: Events flagged with `LLKHF_INJECTED` are ignored, preventing Spitit’s own automated `Ctrl+V` pastes from triggering or corrupting hotkey detection.
4. **Watchdog Timer & Self-Healing**: A 2-second background heartbeat thread monitors hook vitality and transparently unhooks and re-registers `WH_KEYBOARD_LL` if Windows silently detaches it due to callback latency or sleep/wake cycles.
5. **Missed Key-Up Recovery**: Periodic state synchronization uses `GetAsyncKeyState` to detect if physical keys were released during window switches (Alt+Tab) or lock screen events.
6. **Candidate Promotion Timer (Hold Mode)**: When entering `CandidateHold`, a background timer thread checks if the combo is held past `min_hold_time` and automatically promotes state to `Recording` (`StartConfirmed`), popping up the pill and starting wave animations while holding. On physical key release, the dictation stops and transcribes cleanly.
7. **Extended Key Normalization & Right Alt (`VK_RMENU`)**: Extended key flags (`LLKHF_EXTENDED`) in `WH_KEYBOARD_LL` are inspected to distinguish Left Alt (`VK_LMENU`) from Right Alt (`VK_RMENU`). Right Alt is supported both as a single-key hotkey and in multi-key combinations with Warning tier validation.
8. **Global Key Recorder**: Key listening in `App.tsx` captures key events globally at the capture phase, instantly detecting pressed keys without requiring manual input focus.
9. **3-Tier Hotkey Validation**:
   - **Blocked**: Single typing keys (letters, digits, space, Enter, Tab), Esc, system-reserved combos (`Win+*`, `Ctrl+Alt+Del`, `Alt+Tab`, `Alt+F4`, `Ctrl+C/V/X/Z/A/S/W/T/N`).
   - **Warning**: Layout switchers (`Alt+Shift`, `Ctrl+Shift`), `Right Alt`, `Ctrl+Space`, modifier + letter.
   - **OK**: Standard safe combinations (e.g. `Alt + LShift`, `Ctrl + Shift + Space`).

### B. Thread-Safe Audio Pipeline (`recorder.rs`)
1. **Actor Architecture**: Completely eliminated `unsafe impl Send/Sync` on `cpal::Stream`. The stream lives exclusively inside a dedicated audio worker thread communicating over thread channels.
2. **Mic-First Startup**: Audio stream initializes on key press (`StartCandidate`). UI and sounds only trigger once audio is confirmed flowing and the tap threshold is met (`StartConfirmed`).
3. **Windows Microphone Privacy Detection**: Checks Windows Registry (`ConsentStore\microphone` and `NonPackaged` subkeys) for global or desktop privacy denials, immediately returning honest error codes (`ERR_MIC_PRIVACY_GLOBAL`, `ERR_MIC_PRIVACY_APPS`) with settings deep-linking instead of failing silently.
4. **Real-Time RMS Voice Streaming**: Calculates RMS mic levels and streams live updates (30–50 Hz) over Tauri IPC to drive the pill's waveform bars.
5. **90-Second Hard Cutoff & Countdown**: Automatically stops recording at 90 seconds. Emits a live countdown during the final 10 seconds. On cutoff, audio is transcribed and pasted immediately.
6. **Silence Trimming**: In-memory leading and trailing silence trimming drops empty air before uploading to Groq. Audio containing no audible speech is dropped locally and triggers an honest error without burning API tokens.

### C. Signature Display-Only Pill Capsule (`Pill.tsx`, `Pill.css`, `PillWindow.tsx`)
1. **Layout & Elements**:
   - **Left**: Captured active application icon (captured at hotkey press).
   - **Middle**: 5 dynamic voice-reactive waveform bars driven by real-time mic levels (resting calmly in silence, expanding dynamically with speech intensity).
   - **Right**: Elapsed timer / countdown display.
   - **Zero Buttons**: Completely display-only during recording and processing. No stop or cancel buttons.
2. **Rotating Border Beam**: Implemented using `@property --beam-angle` with an animated conic gradient along the capsule border. Runs exclusively during `recording`, respects `prefers-reduced-motion`, and dynamically updates live upon settings changes via `settings_updated` event listener.
3. **Anti-Maximize & Anti-Trap Protection**:
   - Stripped `WS_MAXIMIZEBOX` and `WS_THICKFRAME` on the HWND in `lib.rs`.
   - Single drag mechanism guarded by `e.detail === 1`. Double-clicks and triple-clicks are strictly intercepted with `e.preventDefault()`, completely preventing the window from scaling or trapping the mouse cursor.
4. **Single-Source Audio Playback**: Chime playback is centralized in `PillWindow.tsx` via `play_start_sound` and `play_done_sound` backend events, eliminating double-sound bugs.
5. **State Morphs**:
   - `Recording` → `Processing` (waveform morphs into smooth CSS spinner with "Transcribing" label).
   - `Processing` → `Done` (self-drawing checkmark tick + word count tag).
   - `Escape` → `Cancelled` (brief neutral dismissal).
   - `Error` → Cross icon with plain-language cause (never "Cancelled" for errors). Clicking the error pill directly deep-links to the corresponding Windows Settings page (`ms-settings:privacy-microphone`, `ms-settings:sound`).

### D. Active Application Tracking (`app_tracker.rs`)
1. **32-Bit RGBA PNG Icons**: Replaced BMP extraction with high-quality PNG data URLs, preserving full alpha transparency at small icon sizes.
2. **Packaged UWP/MSIX Support**: Traverses child `CoreWindow` handles beneath `ApplicationFrameWindow` to extract real executable paths and icons for modern Windows Store apps.
3. **Non-Blocking & Retryable**: Extraction runs asynchronously in background tasks. Failed lookups fallback to a neutral mic glyph and are retried on future switches rather than permanently cached as `None`.
4. **Captured at Press Time**: Active window HWND and metadata are frozen at the exact moment the hotkey is pressed, ensuring the transcript pastes to the correct window even if focus shifts while speaking.

### E. Output Pipeline & Paste Safety (`paster.rs`)
1. **Modifier Release Wait**: Uses `GetAsyncKeyState` to confirm physical modifier keys (Alt, Shift, Ctrl) are released before sending `Ctrl+V`.
2. **Target Activation**: Activates the target window via Win32 `SetForegroundWindow` and `BringWindowToTop`.
3. **Elevated Window Detection**: Checks if the target window belongs to an elevated (Admin) process. If non-elevated Spitit cannot paste into it, Spitit leaves the text in the clipboard and alerts the user instead of failing silently.
4. **Clipboard Retention & Win+V History**: The transcript remains in the user's clipboard and is included in Windows Clipboard History (Win+V). Detects whether Clipboard History is enabled and prompts the user to enable it.

### F. Decoupled SQLite Database (`db.rs`)
1. **`text_history` Table**: Stores transcribed text, app name, icon, language, and timestamp. Capped strictly at 500 records. Controlled by the **"Save history"** toggle (no text is written to disk if toggled off).
2. **`usage_stats` Table**: Stores only telemetry metadata (timestamp, word count, speaking duration, app name, language). **Zero speech text is stored**. Has its own **"Keep usage stats"** toggle with automatic 90-day retention pruning.
3. **Honest Dashboard Calculations**: Real WPM computed from active speaking duration; real 7-day calendar day distribution; time saved estimated vs 40 WPM typing. Empty states shown when data is empty.

### G. Security & Credentials (`credentials.rs`)
1. **Windows Credential Manager Only**: API keys are stored exclusively in Credential Manager via `keyring` (Target: `REREAL_Spitit`).
2. **Zero Plain-Text Keys**: Automatically migrates and permanently deletes legacy `groq.key` files from `%LOCALAPPDATA%`.

### H. First-Run Onboarding & System Lifecycle (`App.tsx`, `lib.rs`)
1. **6-Step Onboarding Wizard**: First launch presents a guided setup covering Welcome, API Key validation, Hotkey testing, Live microphone VU meter test, Win+V clipboard history check, and Ready summary.
2. **Silent Startup**: Windows startup launches passing `--autostart` start completely silently in the system tray without opening any windows or showing splashes.

---

## 4. Build & Distribution

```bash
# 1. Install frontend dependencies
npm install

# 2. Run Vite frontend dev server (Pill & UI preview)
npm run dev

# 3. Build production bundle and NSIS installer
npm run tauri build
```

Production artifacts generated:
- Standalone executable: `D:\codevs\Spitit\spitit-v3.exe`
- NSIS Setup Installer: `D:\codevs\Spitit\Spitit_3.0.0_x64-setup.exe`
