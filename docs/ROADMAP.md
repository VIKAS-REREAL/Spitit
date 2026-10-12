# Spitit Roadmap

This document outlines the development direction for Spitit. Spitit follows a focused, lightweight philosophy: fast, native voice-to-text without AI clutter, subscriptions, or telemetry.

---

## Current Release: v3.0 (Tauri 2 + Rust Core)

- [x] **Native Win32 Low-Level Keyboard Engine**: Global `WH_KEYBOARD_LL` hook supporting modifier-only combos (`Alt + LShift`) and custom shortcuts in Hold and Toggle modes.
- [x] **Signature Glass Status Pill**: Overlay window with `WS_EX_NOACTIVATE`, multi-monitor DPI scaling, and real-time voice waveform visualization.
- [x] **WASAPI Audio Pipeline**: 16 kHz mono in-memory PCM capture with silence trimming and 90-second safety cutoff.
- [x] **Direct Groq Cloud Acceleration**: Fast Whisper (`whisper-large-v3-turbo`) and Roman Hinglish transliteration (`llama-3.1-8b-instant`).
- [x] **Secure BYOK Storage**: Credentials stored strictly in Windows Credential Manager.
- [x] **Local Storage**: Embedded SQLite database for text history (with instant privacy disable toggle) and local usage statistics.
- [x] **System Integration**: Tray minimize, auto-start on Windows login (`--autostart`), and foreground application icon detection.

---

## Near-Term: v3.1

- [ ] **Open-Source Code Signing**: Integration with SignPath Foundation's OSS code signing program to eliminate Windows SmartScreen warnings on official release binaries.
- [ ] **Microsoft Store MSIX Package**: Full-trust MSIX package certified for the Microsoft Store.
- [ ] **Audio Device Selector**: Dedicated in-app microphone selector with live input level testing.
- [ ] **Custom Pill Positioning**: Options to dock the status pill near the active caret, centered at screen top, or fixed at a user-defined screen position.
- [ ] **Enhanced Hotkey Profiles**: Option to define alternate secondary hotkeys for specific languages (e.g., Hotkey 1 for English, Hotkey 2 for Hinglish).

---

## Future: v3.2 & Beyond

- [ ] **Local Offline Mode**: Optional local Whisper inference engine (via `whisper.cpp` or ONNX Runtime DirectML) for users requiring air-gapped or 100% offline dictation.
- [ ] **Per-Application Language Rules**: Automatic language switching based on active foreground application (e.g., Hinglish for WhatsApp, English for VS Code).
- [ ] **Pill Aesthetic Customization**: Configurable accent colors and high-contrast accessibility themes.

---

## Project Non-Goals

To maintain high performance and low resource consumption, the following features are explicitly out of scope for Spitit:

1. **No Cloud Accounts or Subscriptions**: Spitit will remain 100% Bring-Your-Own-Key (BYOK) and free open source.
2. **No Remote Telemetry**: No usage metrics or audio will ever be transmitted to REREAL servers.
3. **No AI Rewriting or Chatbots**: Spitit is a dedicated dictation and speech-to-text tool, not an AI conversational chatbot or meeting summarizer.
4. **No Heavy Web Runtimes**: Core OS hooks and system interactions will remain in native Rust to preserve the sub-40 MB idle footprint.
