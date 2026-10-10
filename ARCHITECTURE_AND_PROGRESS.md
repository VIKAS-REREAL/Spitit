# REREAL Spitit v3 — Architecture, Context & Progress

> **Context for Antigravity & Collaborators**: This document contains the complete context, architectural blueprints, implementation status, and instructions for REREAL Spitit v3. Spitit is a high-speed, voice dictation desktop app for Windows.

---

## 1. Executive Summary & Stack

| Dimension | Specification |
|---|---|
| **Core Architecture** | **Tauri 2 (Rust Core + WebView2 React/Vite/TS UI)** |
| **Idle Resource Target** | **≤ 40 MB RAM**, 0% CPU idle in system tray |
| **Store Packaging** | **MSIX** (signed by Microsoft Store, no expensive third-party certs) |
| **Audio Pipeline** | `cpal` (WASAPI 16 kHz mono) → in-memory WAV (`hound`) → Groq Whisper (`whisper-large-v3-turbo`) |
| **Hinglish Normalizer** | Groq Llama (`llama-3.1-8b-instant`) Roman script cleanup |
| **Output Pipeline** | Clipboard set (`arboard`) + Win32 `SendInput` `Ctrl+V` |
| **Security** | Windows Credential Manager (`keyring` crate) for Groq API Key |

---

## 2. Directory Structure (`D:\codevs\Spitit`)

```
D:\codevs\Spitit\
├── assets\                     # Application icons (.ico, .png, .svg) and sound (done.wav)
├── public\                     # Static web assets
├── src\                        # React 19 + TypeScript Frontend
│   ├── components\
│   │   ├── Pill.tsx            # Signature Pill Capsule (Recording, Silent, Done, Cancelled, Error)
│   │   ├── Pill.css            # Conic-gradient edge shine, wave animations, glassmorphism
│   │   └── PillStudio.tsx      # Interactive visual gallery & state simulator
│   ├── App.tsx                 # Main application dashboard & Step 1 test harness
│   ├── App.css                 # Base theme styles (Dark mode, Brand Yellow #FFD505)
│   └── main.tsx                # React root mount
├── src-tauri\                  # Rust Backend
│   ├── src\
│   │   ├── hotkey.rs           # Low-level keyboard hook (WH_KEYBOARD_LL) for Alt+LShift
│   │   ├── recorder.rs         # cpal WASAPI 16 kHz mono capture & hound in-memory WAV
│   │   ├── transcriber.rs      # Port of Groq Whisper + Llama Hinglish cleanup 1:1
│   │   ├── paster.rs           # Native clipboard set & SendInput Ctrl+V auto-paster
│   │   ├── credentials.rs      # Windows Credential Manager storage for Groq API key
│   │   ├── lib.rs              # Tauri 2 app builder, single-instance, tray icon, & IPC
│   │   └── main.rs             # Application entry point
│   ├── Cargo.toml              # Rust crate dependencies
│   ├── build.rs                # Tauri build hook
│   └── tauri.conf.json         # Tauri 2 window & bundle configuration
├── package.json                # Frontend npm configuration
├── tsconfig.json               # TypeScript configuration
├── vite.config.ts              # Vite configuration
├── SPITIT_V3_SPEC.md           # The primary specification brief (single source of truth)
├── ARCHITECTURE_AND_PROGRESS.md# This document
└── README.md                   # Project overview & quickstart
```

---

## 3. What Has Been Completed

### A. Step 1: Core Spike (Proven & Implemented)
1. **Low-Level Hook (`hotkey.rs`)**:
   - Implemented using Win32 `WH_KEYBOARD_LL`.
   - Supports modifier-only combinations (`Alt + LShift`).
   - **Hold Mode**: Starts recording on combo down. Switching windows (Alt+Tab) or pressing extra keys does NOT stop recording; only releasing a combo key stops it.
   - **Toggle Mode**: Starts recording on press, stops ONLY when the same combo is pressed again.
   - **Debounce**: Prevents Windows from firing the language layout switcher.
   - Never swallows regular keys (`CallNextHookEx`).
2. **Audio Capture (`recorder.rs`)**:
   - `cpal` WASAPI stream recording at 16,000 Hz, mono channel.
   - In-memory encoding using `hound`. No temporary disk files.
   - Minimum duration enforcement (0.3s) and auto-stop limit (120s).
   - RMS volume silence check (`threshold: 0.01`).
3. **Transcription (`transcriber.rs`)**:
   - 1:1 port from Python reference using `reqwest`.
   - Uses `whisper-large-v3-turbo` with prompt guidance.
   - Hinglish cleanup mode calls `llama-3.1-8b-instant` with exact system prompt, temperature `0.05`, max tokens `1024`.
4. **Auto-Paste (`paster.rs`)**:
   - Clipboard set via `arboard`.
   - 50ms delay for clipboard settling.
   - Simulates `Ctrl+V` using Win32 `SendInput`.
5. **Credential Storage (`credentials.rs`)**:
   - Integrates with Windows Credential Manager (`keyring` crate).
   - Target name: `REREAL_Spitit`. No plain-text API keys in JSON files.
6. **Single Instance & System Tray (`lib.rs`)**:
   - Uses `tauri-plugin-single-instance`. Second launch brings the active window to front.
   - System tray registered with "Open Spitit" and "Quit Spitit".

### B. Step 2: The Pill UI & Design Reference Parity
Implemented in [`src/components/Pill.tsx`](./src/components/Pill.tsx) and [`src/components/Pill.css`](./src/components/Pill.css):
1. **Geometry & Glassmorphism**:
   - Fully rounded capsule, `#111113` dark glass, backdrop blur `16px`, subtle 1px border.
   - Draggable anywhere across monitors with smooth mouse drag delta.
2. **Conic-Gradient Edge Shine**:
   - Uses CSS `@property --shine-angle` and rotating `conic-gradient` highlight behind a 1.5px border mask.
   - Runs exclusively during the `recording` state.
3. **Pill States Implemented**:
   - **Recording**: Cancel `x` on left, live reacting waveform bars, red stop square on right, border shine active.
   - **Silent / Low Voice**: Waveform dots/dashes waiting for voice level.
   - **Processing**: Smooth spinner arc morphing from the waveform.
   - **Done**: Self-drawing checkmark tick (`stroke-dashoffset` animation) + `12 words` green tag.
   - **Cancelled Toast** *(from user screenshot bottom-right)*:
     - Purple/violet `(!)` circle badge.
     - "Transcript cancelled" label.
     - Rounded "Undo" button.
   - **Error Pop-up Box ("We couldn't hear you")** *(from user screenshot top-right)*:
     - Red `(!)` circle badge + "We couldn't hear you" title.
     - Description: "We didn't pick up any speech from your Built-in mic (recommended) microphone".
     - Action buttons: `Select microphone` and `Troubleshoot`.
     - Top-right close `x` dismiss button.
4. **Pill Studio (`PillStudio.tsx`)**:
   - Integrated in `App.tsx` for live state simulation, state switching, and side-by-side design inspection.

---

## 4. Development & Build Commands

Inside `D:\codevs\Spitit`:

```bash
# 1. Install frontend dependencies
npm install

# 2. Run Vite frontend dev server (Pill & UI preview)
npm run dev

# 3. Build frontend bundle
npm run build

# 4. Run Tauri desktop app (requires MSVC build tools on Windows)
npm run tauri dev
```

---

## 5. Next Steps for Step 3 & 4

1. **Window Hierarchy**:
   - Split Tauri configuration into two windows:
     - `pill`: Frameless, transparent, `alwaysOnTop: true`, `skipTaskbar: true`, `decorations: false`.
     - `main`: Settings window (Home, History SQLite, Dictation, Sound, API Key), hidden to tray on close.
2. **Active App Icon Resolution**:
   - Integrate Win32 `EVENT_SYSTEM_FOREGROUND` via `SetWinEventHook` to extract and display the foreground process icon inside the pill's left circle with crossfade animation.
3. **SQLite History**:
   - Integrate SQLite (`rusqlite`) for local history cap of 500 dictations.
