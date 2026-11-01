# Spitit

<div align="center">

**Ultra-fast, private voice dictation for Windows 10 & 11.**  
Powered by your own Groq API key. Zero telemetry, zero accounts, sub-40 MB idle RAM.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011-blue.svg)](https://github.com/VIKAS-REREAL/Spitit)
[![Built with Tauri](https://img.shields.io/badge/Built%20with-Tauri%202-24C8DB.svg)](https://tauri.app)
[![Inference](https://img.shields.io/badge/Cloud%20LPU-Groq%20Whisper-F55036.svg)](https://groq.com)

[Download](#-official-downloads) • [Features](#-features) • [Privacy Architecture](#-honest-privacy-architecture) • [Keyboard Hook Security](#-what-the-keyboard-hook-does-and-does-not-do) • [Build from Source](#-building-from-source) • [FAQ](#-frequently-asked-questions)

</div>

---

## What is Spitit?

Spitit is an open-source desktop dictation tool for Windows. Hold down your global hotkey (default: `Alt + Left Shift`), speak naturally, and release. Your speech is transcribed via Groq's low-latency Whisper LPU and pasted instantly into whatever application you are currently typing in.

Spitit is built from the ground up to be:
- **Fast:** Direct Win32 hooks and 16 kHz in-memory WASAPI streaming eliminate disk latency. Transcriptions land in ~200–400 ms.
- **Lightweight:** Native Rust core with Tauri 2 idles at under 35 MB of RAM in the system tray with 0% CPU.
- **Honest & Private:** Zero Spitit servers. Zero telemetry. Audio streams directly between your machine and Groq Cloud over TLS using your personal API key.
- **Hinglish-First:** Specialized natural romanized Hinglish cleanup alongside standard English, Hindi, and 90+ languages.

---

## How It Works in 3 Steps

1. **Hold to Speak:** Press and hold `Alt + Left Shift` (or toggle mode, or your custom shortcut) in any Windows application.
2. **Signature Glass Pill:** A non-activating floating status pill appears with an audio waveform responding to your live voice intensity.
3. **Release to Paste:** Release the hotkey. Your audio is transcribed and pasted into your active cursor position via simulated `Ctrl + V`.

---

## Features

- **Signature Glass Status Pill**:
  - Live 5-bar voice waveform reacting to WASAPI RMS audio intensity.
  - Rotating edge beam highlight during active speech.
  - Multi-monitor DPI aware; uses `WS_EX_NOACTIVATE` so it **never steals focus** from your active window.
  - Smooth visual morphs into processing spinner, checkmark, and honest error states.
- **Win32 Low-Level Keyboard Engine (`WH_KEYBOARD_LL`)**:
  - Global push-to-talk (hold mode) and toggle mode.
  - 3-tier validation (Blocked, Warning, OK) preventing accidental typing key binds.
  - Dedicated background thread with self-healing watchdog.
- **Pure In-Memory Audio Pipeline**:
  - 16 kHz 16-bit mono PCM via `cpal` (WASAPI shared mode).
  - Encoded directly into an in-memory WAV container with `hound`. **Zero temporary audio files on disk.**
  - Real-time RMS silence trimming and 90-second safety cutoff with countdown alert.
- **Secure Bring-Your-Own-Key (BYOK)**:
  - Your Groq API key is stored strictly within **Windows Credential Manager** (`keyring`).
  - Zero plaintext keys stored in settings files or SQLite databases.
- **Local SQLite History & Productivity Analytics**:
  - Optional transcription history (capped at 500 records) with an instant privacy kill-switch.
  - Local usage statistics tracking speaking duration, word counts, and estimated typing time saved.
- **Honest Diagnostics**:
  - 11 distinct plain-language error reasons (mic privacy blocked, device muted, exclusive mode in use, rate limits, no speech heard).
  - Clicking error pills opens the exact Windows Settings page.

---

## Honest Privacy Architecture

Many dictation tools claim to be "100% private" or "offline" while quietly transmitting audio to cloud servers. Spitit does not mislead:

| Data Flow | Destination | Details |
|---|---|---|
| **Audio Voice Clips** | **Direct to Groq Cloud** | Audio is streamed over encrypted HTTPS directly to `api.groq.com` using your personal Groq API key. Subject to [Groq Privacy Policy](https://groq.com/privacy-policy/). |
| **API Key Credentials** | **Local Machine** | Encrypted and stored in native Windows Credential Manager under the `Spitit` target. |
| **Dictation History** | **Local Machine** | Stored in `%APPDATA%\com.rereal.spitit\spitit.db`. Can be disabled or cleared at any time. |
| **Foreground App Detection** | **Local Machine** | Queries active window title and process icon to show in status pill and local statistics. Does **not** read window contents. |
| **Spitit / REREAL Telemetry** | **None (Zero)** | **There are no Spitit backend servers, no analytics pings, no tracking pixels, and no accounts.** |

For complete details, read our [Privacy Policy](./PRIVACY.md).

---

## What the Keyboard Hook Does (and Does NOT Do)

Spitit installs a Windows Low-Level Keyboard Hook (`WH_KEYBOARD_LL`) to provide system-wide push-to-talk hotkeys that work inside any app, terminal, or browser. Because unsigned keyboard hooks are occasionally flagged by overzealous antivirus utilities, we are completely transparent:

- **What it DOES do:**
  - Evaluates designated modifier key states (`VK_LMENU`, `VK_RMENU`, `VK_LSHIFT`, `VK_RSHIFT`, etc.).
  - Distinguishes between physical key-down and key-up events to manage push-to-talk timing.
  - Ignores synthetic keystrokes (`LLKHF_INJECTED`) to avoid feedback loops.
- **What it DOES NOT do:**
  - It **never logs, stores, or buffers keystrokes** that you type.
  - It **never transmits keystrokes** over the network.
  - It **never intercepts or swallows normal typing**; all non-hotkey events are forwarded immediately via `CallNextHookEx`.

> [!TIP]
> You can inspect the entire keyboard hook implementation directly in [`src-tauri/src/hotkey.rs`](file:///d:/codevs/Spitit/src-tauri/src/hotkey.rs).

---

## Official Downloads

Official release binaries are published **exclusively** on GitHub Releases:

- **Official Repository Releases:** [https://github.com/VIKAS-REREAL/Spitit/releases](https://github.com/VIKAS-REREAL/Spitit/releases)
- **Official Website:** [https://vikas-rereal.github.io/Spitit/](https://vikas-rereal.github.io/Spitit)

> [!WARNING]
> Do not download Spitit from third-party software mirrors, aggregator sites, or unauthorized distributions. Official builds always publish corresponding `SHA256SUMS.txt` cryptographic checksums.

### Verifying Release Checksums
To verify that your downloaded binary is authentic and unmodified, run in PowerShell:
```powershell
Get-FileHash -Algorithm SHA256 .\Spitit_3.0.0_x64-setup.exe
```
Compare the output hash against the hash listed in `SHA256SUMS.txt` on the release page.

### Windows SmartScreen ("Unknown Publisher")
Because Spitit is an independent open-source project without an expensive corporate Extended Validation (EV) certificate, Windows SmartScreen may display an *"Unknown Publisher"* prompt on first launch.
- To run: Click **"More info"** -> **"Run anyway"**.
- Code Signing Roadmap: We are actively pursuing free open-source signing through the [SignPath Foundation OSS Program](https://signpath.org/) and official Microsoft Store MSIX packaging.

---

## Quickstart

### Prerequisites
- Windows 10 (version 1809+) or Windows 11 (64-bit).
- A free Groq Cloud API key from [console.groq.com](https://console.groq.com) (free tier includes generous Whisper rate limits).

### Setup in 3 Minutes
1. Download and run `Spitit_3.0.0_x64-setup.exe` (or extract `Spitit_3.0.0_portable.exe`).
2. Launch Spitit from the Start Menu or System Tray.
3. Open **Settings** -> **Groq API Key**, paste your `gsk_...` key, and click **Save Key**.
4. Click **Test Key** to verify your connection.
5. In any window, hold `Alt + Left Shift`, speak, and release.

---

## Building from Source

To build Spitit yourself:

### Requirements
- [Node.js](https://nodejs.org/) v18+ (LTS recommended)
- [Rust & Cargo](https://rustup.rs/) (stable channel)
- Visual Studio C++ Build Tools with MSVC and Windows 10/11 SDK
- Microsoft Edge WebView2 Evergreen Runtime

### Build Steps

```bash
# 1. Clone the repository
git clone https://github.com/VIKAS-REREAL/Spitit.git
cd Spitit

# 2. Install frontend dependencies
npm install

# 3. Build production bundle (generates installer and portable exe)
npm run tauri build
```

Compiled binaries will be created in:
- `src-tauri/target/release/bundle/nsis/` (Setup Installer)
- `src-tauri/target/release/spitit-v3.exe` (Portable Executable)

---

## Frequently Asked Questions

#### Is Spitit free and open source?
Yes. Spitit is 100% open-source software under the [MIT License](./LICENSE). You may use it freely for personal and commercial purposes.

#### Do I need to pay for Groq?
Groq provides a generous free tier for its Cloud API (thousands of audio seconds per day) which is more than sufficient for everyday voice dictation. If you exceed free-tier quotas, Groq bills directly under their standard API pricing. Spitit charges zero fees and takes zero commission.

#### Does Spitit work offline?
Not in v3.0. Transcriptions stream to Groq's high-speed cloud LPU to keep memory usage under 35 MB and avoid gigabytes of model downloads. Fully offline local transcription via ONNX / whisper.cpp is planned on our [Roadmap](./docs/ROADMAP.md).

#### Why doesn't the hotkey work in administrator windows or games?
Windows employs **UIPI (User Interface Privilege Isolation)**. A standard-privilege application cannot intercept keyboard events or inject `SendInput` keystrokes into windows running with elevated Administrator privileges. To dictate into elevated applications (e.g., Administrator PowerShell or CMD), run Spitit as Administrator.

#### How do I uninstall and completely wipe all data?
1. In Spitit Settings -> History & Privacy, click **"Clear History Now"**.
2. Open Windows Credential Manager (`control keymgr.dll`) and remove the `Spitit` entry.
3. Uninstall Spitit via Windows **Installed Apps**.
4. Delete the local configuration directory: `%APPDATA%\com.rereal.spitit`.

---

## Trademark & Brand Notice

The source code and documentation of Spitit are licensed under the [MIT License](./LICENSE).

The project names **Spitit** and **REREAL**, along with the official logos and app icons, are reserved marks. You are welcome to fork the code, but redistributed forks and third-party packages must use their own distinct name and brand identity. See [TRADEMARK.md](./TRADEMARK.md) for complete details.

---

## Contributing & Community

Contributions are warmly welcomed! Please read:
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Setup instructions and Developer Certificate of Origin (DCO) guidelines.
- [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) — Community standards.
- [SECURITY.md](./SECURITY.md) — Vulnerability disclosure process.
- [CHANGELOG.md](./CHANGELOG.md) — Version history.

---

## Credits & Disclaimers

- Developed by **Vikas Nath (REREAL)** and community contributors.
- Uses the **Whisper** model architecture developed by OpenAI.
- Uses **Groq Cloud API** for LPU inference.
- Built on the **Tauri** desktop framework.
- *Spitit is an independent open-source project and is not affiliated with, sponsored by, or endorsed by Groq Inc., OpenAI, or Microsoft Corporation.*
