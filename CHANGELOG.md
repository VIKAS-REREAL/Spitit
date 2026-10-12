# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.0] - 2026-10-12

### Added
- **Tauri 2 & Rust Re-architecture**: Complete native rewrite from legacy Python runtime to Tauri 2 and Rust, reducing idle memory from ~150 MB down to < 40 MB.
- **Signature Glass Status Pill**: Overlay window with `WS_EX_NOACTIVATE`, multi-monitor DPI scaling, and real-time voice waveform visualization responding to WASAPI audio RMS intensity.
- **Low-Level Keyboard Engine (`WH_KEYBOARD_LL`)**: Native Win32 hook supporting modifier-only combos (`Alt + Left Shift`) in both Push-to-Talk (Hold) and Toggle modes with self-healing watchdog.
- **Direct Groq Cloud Acceleration**: Fast speech-to-text with `whisper-large-v3-turbo` and optional Roman Hinglish transliteration via `llama-3.1-8b-instant`.
- **Windows Credential Manager Storage**: User API keys persisted securely in native Windows Credential Manager (`keyring`), eliminating plaintext keys on disk.
- **In-Memory Audio Capture**: Zero temporary WAV files on disk; pure in-memory WASAPI stream with silence detection and 90-second safety cutoff.
- **Synthetic Auto-Paste Engine**: Native Win32 `SendInput` simulation synchronized with physical modifier key release.
- **Local SQLite History & Telemetry**: SQLite-backed transcription history (capped at 500 records with an instant disable toggle) and local 90-day usage analytics.
- **Active Window Tracker**: Local detection of foreground application process name and icon for pill display and usage metrics.
- **Honest Diagnostics**: 11 distinct plain-language error reasons with Windows Settings deep-links.

### Changed
- Relicensed entire codebase under standard **MIT License**.
- Updated packaging to produce both NSIS Setup installer and portable single-binary executable.

### Retired
- **v2.x Python Codebase**: The legacy Python implementation (`REREAL-Spitit`) is archived and superseded by Spitit v3.
