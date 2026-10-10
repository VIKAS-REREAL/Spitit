# REREAL Spitit v3

> Real-time voice dictation with an ultra-lightweight footprint, beautiful glassmorphism status pill, and instant auto-paste for Windows.

## Overview

REREAL Spitit v3 is rebuilt from the ground up using **Tauri 2 (Rust core + React 19 / TypeScript UI)**. It features an idle RAM footprint of under 40 MB, native `WH_KEYBOARD_LL` hotkeys supporting modifier-only combos (`Alt + LShift`), 16 kHz in-memory WASAPI audio capture, Groq Whisper transcription (`whisper-large-v3-turbo`), and Hinglish Roman transliteration cleanup (`llama-3.1-8b-instant`).

## Key Features

- **Signature Glass Pill**:
  - Live animated waveform bars responding smoothly to speech.
  - Conic-gradient edge shine traveling along the capsule border.
  - States: Recording, Silent Dots, Processing Spinner, Done Checkmark, "Transcript cancelled [Undo]" toast, and "We couldn't hear you" error pop-up box.
  - Draggable anywhere across multiple monitors.
- **Low-Level Keyboard Hook (`WH_KEYBOARD_LL`)**:
  - Hold mode and Toggle mode for `Alt + LShift`.
  - Survives Alt+Tab and window switching without interrupting speech.
  - Never swallows regular keys.
- **In-Memory Audio Capture**:
  - `cpal` WASAPI mono capture at 16,000 Hz.
  - Purely in-memory WAV encoding with `hound`. No temporary disk files.
  - Built-in RMS volume silence detection.
- **Auto-Paste**:
  - Copies to clipboard and sends `Ctrl+V` via Win32 `SendInput`.
- **Credential Security**:
  - API keys stored securely in Windows Credential Manager (`keyring`).
- **Single Instance & System Tray**:
  - Multi-process launch prevention and system tray menu.

## Quickstart

```bash
# Install frontend dependencies
npm install

# Start frontend dev server / Pill preview
npm run dev

# Run Tauri desktop app
npm run tauri dev

# Build release
npm run tauri build
```

## Documentation

- [`SPITIT_V3_SPEC.md`](./SPITIT_V3_SPEC.md): Full product, UI, and Microsoft Store specification.
- [`ARCHITECTURE_AND_PROGRESS.md`](./ARCHITECTURE_AND_PROGRESS.md): Detailed architectural documentation and current implementation status.
