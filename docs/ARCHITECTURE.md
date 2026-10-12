# Spitit v3 Architecture

## 1. System Overview

Spitit is an open-source, ultra-low-latency voice dictation client for Windows 10 and 11. It is built on **Tauri 2**, pairing a native **Rust** core for Win32 OS integration with a lightweight **WebView2 (React 19 + TypeScript)** interface for hardware-accelerated animations.

```
+-------------------------------------------------------------------------+
|                              User Action                                |
|                Hold / Toggle Global Shortcut (e.g., Alt + LShift)       |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                     Native Rust Core (Win32 API)                        |
|                                                                         |
|  +-----------------------+  +-------------------+  +-----------------+  |
|  | WH_KEYBOARD_LL Hook   |  | WASAPI Capture    |  | App Tracker     |  |
|  | Low-level global hook |  | 16 kHz Mono PCM   |  | GetForeground   |  |
|  | Dedicated thread      |  | In-memory WAV     |  | Window & Icon   |  |
|  +-----------+-----------+  +---------+---------+  +--------+--------+  |
|              |                        |                     |           |
+--------------|------------------------|---------------------|-----------+
               |                        |                     |
               v                        v                     v
+-------------------------------------------------------------------------+
|                  Floating Status Pill (WebView2 Window)                 |
|  - WS_EX_NOACTIVATE (never steals typing focus)                         |
|  - Live 5-bar voice waveform reacting to 30-50 Hz RMS stream            |
|  - Morphing states: Recording -> Processing -> Done / Error             |
+---------------------------------------+---------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------+
|                      Transcription Engine (Direct TLS)                  |
|  - Audio streamed directly to Groq Whisper (whisper-large-v3-turbo)     |
|  - Optional Roman Hinglish formatting via Groq Llama 3.1 8B             |
|  - BYOK (Bring Your Own Key) authenticated                              |
+---------------------------------------+---------------------------------+
                                        |
                                        v
+-------------------------------------------------------------------------+
|                      Synthetic Auto-Paste Engine                        |
|  - Clipboard buffer populated via native Win32 clipboard API            |
|  - Modifier release synchronization                                     |
|  - SendInput synthetic Ctrl+V keystroke injection                       |
+-------------------------------------------------------------------------+
```

---

## 2. Low-Level Keyboard Engine (`WH_KEYBOARD_LL`)

Global hotkey detection uses the Windows Win32 Low-Level Keyboard Hook (`SetWindowsHookExW` with `WH_KEYBOARD_LL`) on a dedicated background thread running a standard Win32 message pump (`GetMessageW` / `DispatchMessageW`).

### Why Low-Level Hooks Instead of `RegisterHotKey`?
Windows `RegisterHotKey` has fundamental constraints:
1. It cannot capture **modifier-only combinations** (such as `Alt + Left Shift`).
2. It swallows keystrokes unconditionally, preventing natural chord handling.
3. It cannot distinguish between key-down and key-up transitions needed for smooth **push-to-talk (hold) mode**.

### Safety and Anti-Keylogger Guarantees
- The hook records **zero keystrokes** to disk or memory.
- It only evaluates configured hotkey modifier states (`VK_LMENU`, `VK_RMENU`, `VK_LSHIFT`, `VK_RSHIFT`, etc.).
- When normal typing occurs, the hook immediately forwards the event down the Windows chain with `CallNextHookEx`.
- Keystrokes with the `LLKHF_INJECTED` flag (synthetic keystrokes, including Spitit's own auto-paste) are ignored to prevent recursive loops.

### Self-Healing Watchdog
Windows occasionally unhooks `WH_KEYBOARD_LL` hooks if a callback exceeds low-level timeout thresholds (e.g. during system sleep or heavy CPU stalls). Spitit runs an asynchronous watchdog that checks hook health and automatically re-arms the hook if unregistered.

---

## 3. Signature Status Pill Window

The status pill is an overlay window (`160x38` logical pixels) designed to give clear, non-intrusive feedback during dictation.

### Non-Activating Window Chrome (`WS_EX_NOACTIVATE`)
If a dictation overlay window takes focus when opening, the user's active editor (VS Code, Slack, Word) loses focus, causing the subsequent auto-paste to fail. Spitit applies native Win32 window styles:
- `WS_EX_NOACTIVATE` — Prevents Windows from activating or bringing focus to the pill.
- `WS_EX_TOPMOST` — Keeps the pill visible above active applications.
- Multi-monitor DPI awareness handles high-DPI scaling dynamically without blurriness.

### Waveform and State Transitions
- **Recording**: Displays the foreground application icon, a 5-bar live waveform responding to WASAPI RMS power levels, and an elapsed timer. A rotating conic-gradient beam highlights the pill boundary.
- **Processing**: The waveform morphs into an animated circular spinner while Groq API processing occurs.
- **Done**: The pill displays a checkmark with transcribed word count and calculated Words-Per-Minute (WPM).
- **Error Diagnostics**: Displays actionable status with direct deep-links to relevant Windows Settings (e.g. Microphone Privacy Settings).

---

## 4. In-Memory Audio Pipeline (`cpal`)

Audio capture uses `cpal` with WASAPI (Windows Audio Session API) in shared mode:
- **Audio Format**: 16,000 Hz, 16-bit Mono PCM (optimal input format for Whisper).
- **In-Memory Buffer**: Raw audio samples are encoded directly into an in-memory WAV container using `hound`. **Zero audio files are written to disk.**
- **Silence Trimming**: Built-in RMS silence detection drops empty air at the start and end of recordings, saving API tokens and accelerating turnaround.
- **Safety Cutoff**: A strict 90-second hardware cutoff timer halts recording automatically with a 10-second countdown alert, preventing runaway background recording.

---

## 5. Transcription & Hinglish Pipeline

Transcriptions stream over encrypted HTTPS directly to Groq's low-latency inference endpoints:
- **Whisper Inference**: `whisper-large-v3-turbo` model provides speech-to-text conversion typically within 200–400 ms.
- **Hinglish Post-Processing**: When Hinglish mode is active, the transcription is cleaned using a specialized `llama-3.1-8b-instant` prompt that normalizes messy transliterations into clean Roman-script Hinglish without altering the underlying meaning.
- **Direct BYOK Authentication**: Calls use the user's personal Groq API key stored in Windows Credential Manager.

---

## 6. Auto-Paste Engine (`SendInput`)

When dictation completes:
1. The transcribed text is written to the Windows Clipboard (`OpenClipboard`, `EmptyClipboard`, `SetClipboardData`).
2. The engine waits for the physical release of all modifier keys (`Alt`, `Shift`, `Ctrl`) to avoid conflicting modifier chords.
3. Native Win32 `SendInput` synthesizes a `Ctrl + V` key-down and key-up sequence targeted at the previously active foreground window.
4. If enabled, text history is committed locally to SQLite. If history is disabled, text remains only in the system clipboard.

---

## 7. Storage, Security & Telemetry

### Windows Credential Manager (`keyring`)
API keys are never stored in plain text, JSON files, or application settings. They are encrypted and persisted exclusively within the native Windows Credential Manager under the `Spitit` service target.

### Local SQLite Database
Settings, history, and usage statistics are stored in an embedded SQLite database (`rusqlite`) in `%APPDATA%\com.rereal.spitit\spitit.db`:
- **`text_history`**: Capped at 500 records. A toggle in Settings disables text retention completely.
- **`usage_stats`**: Stores duration, word counts, and app names for local analytics (WPM and time saved). Retained for 90 days.
- **Zero Cloud Telemetry**: Spitit operates with **zero telemetry servers**, **zero tracking SDKs**, and **zero user accounts**.

---

## 8. Resource Budget

Measured resource consumption on Windows 11 (x64):
- **Idle in System Tray**: ≤ 35 MB RAM, 0% CPU.
- **Active Recording with Pill**: ≤ 85 MB RAM, < 3% CPU.
- **Settings Window Open**: ≤ 140 MB RAM (destroyed on window close to release memory).
