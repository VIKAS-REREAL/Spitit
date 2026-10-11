# REREAL Spitit v3

> Real-time voice dictation with an ultra-lightweight footprint, beautiful glassmorphism status pill, voice-reactive waveform, and instant auto-paste for Windows 10 & 11.

---

## Overview

REREAL Spitit v3 is rebuilt from the ground up using **Tauri 2 (Rust core + React 19 / TypeScript UI)**. It features an idle RAM footprint of under 40 MB for the native Rust core, low-level `WH_KEYBOARD_LL` hotkeys supporting modifier-only combos (`Alt + LShift`) and customizable shortcuts, 16 kHz in-memory WASAPI audio capture, Groq Whisper transcription (`whisper-large-v3-turbo`), and Hinglish Roman transliteration cleanup (`llama-3.1-8b-instant`).

---

## Key Features

- **Signature Glass Pill**:
  - Live animated 5-bar waveform responding to real mic intensity (30–50 Hz RMS stream).
  - Rotating edge beam highlight along the border during recording.
  - Display-only during dictation (app icon on left, waveform in middle, live timer on right; no buttons).
  - Smooth morphs into Transcribing spinner, Done checkmark, Cancelled dismissal, and honest Error diagnostics.
  - Multi-monitor DPI aware with double-click maximize prevention and cursor-drag safety.
- **Robust Low-Level Keyboard Engine (`WH_KEYBOARD_LL`)**:
  - Hold mode and Toggle mode with customizable key combinations.
  - 3-tier validation (Blocked, Warning, OK) preventing accidental typing key binds.
  - Self-healing watchdog thread that re-arms the hook if removed by Windows or sleep/wake cycles.
  - Ignores injected keystrokes and waits for modifier release before sending `Ctrl+V`.
  - Hotkey presses while processing are safely ignored.
- **Actor-Model Audio Pipeline (`cpal`)**:
  - Thread-safe actor architecture with stream contained on a dedicated worker thread.
  - Purely in-memory WAV encoding with `hound`. Zero temporary disk files.
  - 90-second safety cutoff with live 10-second countdown.
  - In-memory silence trimming drops empty air and prevents blank API calls.
- **Honest Diagnostics & Error Deep-Linking**:
  - 11 distinct plain-language error reasons (mic privacy blocked, device muted, exclusive mode in use, rate limits, no speech heard, etc.).
  - Never says "Cancelled" for errors; clicking the error pill opens the exact Windows Settings page.
- **Decoupled SQLite Database**:
  - `text_history`: Transcriptions capped at 500 records with a privacy toggle (zero text written to disk when disabled).
  - `usage_stats`: Privacy-friendly telemetry (speaking duration, word counts, app names, language) with 90-day retention.
  - Honest dashboard stats: Real WPM based on speaking time, real 7-day calendar breakdown, time saved estimate vs 40 WPM typing.
- **Enterprise Security**:
  - API keys stored exclusively in Windows Credential Manager (`keyring`). Zero plain-text keys on disk.
- **System Integration**:
  - Windows Startup (`--autostart`) launches silently in the system tray.
  - Active app icon detection supports classic Win32, Electron, browsers, and UWP/MSIX packaged Store apps.
  - Compatible with Windows Clipboard History (Win+V).

---

## Quickstart

### Prerequisites
- Node.js 18+
- Rust & Cargo (with MSVC build tools on Windows)
- Groq API Key ([console.groq.com](https://console.groq.com))

### Development & Build Commands

```bash
# 1. Install frontend dependencies
npm install

# 2. Run Vite frontend dev server (Pill & UI preview)
npm run dev

# 3. Run Tauri desktop app in dev mode
npm run tauri dev

# 4. Build production bundle and NSIS setup installer
npm run tauri build
```

Production artifacts are output to:
- Standalone Executable: `spitit-v3.exe`
- NSIS Setup Installer: `Spitit_3.0.0_x64-setup.exe`

---

## Documentation

- [`SPITIT_V3_SPEC.md`](./SPITIT_V3_SPEC.md): Full product, UI, and technical specification.
- [`ARCHITECTURE_AND_PROGRESS.md`](./ARCHITECTURE_AND_PROGRESS.md): Architectural deep dive and completed stabilization details.
