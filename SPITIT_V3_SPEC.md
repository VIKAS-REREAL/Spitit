# REREAL Spitit v3: Product, UI and Microsoft Store Spec

> Vicky, this is the brief for [[Antigravity]] to build from. It covers what to keep, what to cut, the page hierarchy, the pill, the tech stack, and the exact steps to get through Microsoft Store certification. The transcription logic in [[transcriber.py]] stays as it is and gets ported 1:1.

Related: [[SPITIT_V3_APP_REDESIGN_SPEC]] (earlier spec, superseded where this one conflicts) · [[REREAL Ecosystem]] · [[Timer-ing]] (you already ship a Tauri Windows app there, so the toolchain is familiar)

---

## 0. TL;DR (read this first)

| Decision | Answer |
|---|---|
| **Stack** | **Tauri 2 (Rust core + WebView2 UI)**. Not Python, not Electron. |
| **Why** | Idle RAM of roughly 15-40 MB instead of 100-200 MB. Premium CSS animation for the pill. Native tray, single instance, MSIX packaging. |
| **Store format** | **MSIX**. Microsoft signs it for you, so there is no code-signing certificate to buy. This is probably what killed your earlier tries. |
| **Other formats** | Portable `.exe`, NSIS `Setup.exe`, optional `.msi`. All built from the same code, with a build flag per channel. |
| **Idle behavior** | Tray only. No visible window. Settings window is created on demand and destroyed on close. |
| **Cut** | Dictionary, snippets, AI edits and rewrites, tone modes, notetaker. None of the "clutter". |
| **Keep** | Transcribe, pill, hotkeys (hold and toggle), history, auto-paste, clipboard, notification, sound, language, mic. |

---

## 1. What Wispr Flow and Superwhisper actually do (and what we take)

From their sites and docs:

**Wispr Flow**
- A small **Flow bar** with a language picker inside it, which is the pill we are matching.
- Pitch: removes filler words, catches corrections, formats as you speak. **We skip this.** You said no AI-edit clutter, and our Hinglish cleanup already covers the one case that matters.
- Extras: personal dictionary, snippets, per-app style. **All cut.**
- Free tier is 2,000 words per week, which shows a usage counter is worth having. Our Home page counts words, but with no limits since you bring your own key.

**Superwhisper**
- App shell with a left sidebar: **Home, Modes, Vocabulary, Configuration**.
- Push to talk (hold, speak, release) plus custom shortcuts.
- Clipboard integration: the transcript is pasted automatically into the app you are in.
- Works offline. **Not now.** See the roadmap in §12.

**Takeaways:** the sidebar shell, hold/toggle with custom keys, and auto-paste are the standard. The thing neither of them does well is the pill's visual polish, which is where we win. The rest of this spec is mostly about that.

---

## 2. Product rules (your non-negotiables, written as testable rules)

1. **Idle = invisible.** Nothing on screen. Only the tray icon. No hover-to-wake pill, no resting pill.
2. **Instant start.** Hotkey down → recording within ~100 ms and the pill appears at once. (The mic stream opens first, then the pill animates in. Never the reverse.)
3. **Single instance.** Launching again (Start menu, search, desktop shortcut) must not start a second process. It opens the Settings/Home window of the running one.
4. **Hotkey survives tab/window switching.** See §6, this is the part most apps get wrong.
5. **Pill never steals focus.** Typing in Notepad continues while the pill is on screen. Otherwise auto-paste lands in the wrong place.
6. **Custom window chrome.** No default Windows title bar on any window.
7. **Transcription logic untouched.** Same Groq Whisper model, same Hinglish prompt, same Llama cleanup, same silence check. We port it, we do not redesign it.
8. **Resource budget** (measured in Task Manager, not guessed):
   - Idle in tray: **≤ 40 MB** total across all of Spitit's processes, 0% CPU.
   - Recording with the pill showing: **≤ 90 MB**, under 5% CPU.
   - Settings window open: **≤ 150 MB**, and memory is released when it closes.

---

## 3. Tech stack (and why Python is out)

### Recommendation: Tauri 2

| Layer | Choice | Reason |
|---|---|---|
| Core | **Rust** | Tiny idle footprint, direct Win32 access for hooks, foreground-window tracking, and click-through/no-activate windows. |
| UI | **WebView2** + **React + Vite + TypeScript** (or Svelte, whichever Antigravity is faster in) | You get real CSS animation (springs, conic-gradient shine, `backdrop-filter`) which is hard to match in Tk. |
| Styling | Tailwind or plain CSS variables, **Framer Motion / Motion One** for morphs | Morph animations are what you asked for, and it makes them trivial. |
| Hotkeys | Low-level keyboard hook (`WH_KEYBOARD_LL`) via the `windows` crate | `RegisterHotKey` cannot do modifier-only combos like Alt+LShift. The LL hook can. |
| Audio capture | `cpal` (WASAPI) → 16 kHz mono → in-memory WAV | Same as now: no temp files. |
| Network | `reqwest` | Two calls: Whisper, and Llama only in Hinglish mode. |
| Paste | Clipboard set + `SendInput` Ctrl+V | Same strategy as the current paster. |
| Tray | Tauri tray API | Native. |
| Notifications | Windows toast via WinRT | Native look, works in MSIX. |
| Single instance | `tauri-plugin-single-instance` | Solves rule 3. |
| Storage | **SQLite** (history, stats) + **Windows Credential Manager** (API key) | Fixes the two weak spots from the earlier code review: plain-text key and JSON history. |

### Why not keep Python?
Python + CustomTkinter idles at 80-150 MB, can't do the pill's shine/morph effects smoothly, and MSIX-packaging a PyInstaller exe is awkward. You said logic is good: it is, and it's ~150 lines of HTTP calls. Porting it is cheap. The risk is in the hook and window layer, and that is where Rust is stronger anyway.

### Honest trade-off
A hidden WebView2 still costs memory (~20-30 MB each). Plan:
- **Pill:** one pre-created, hidden webview so it appears instantly (rule 2). This is the main idle cost.
- **Settings:** created only when opened, destroyed on close.
- If idle exceeds 40 MB in measurement, **Phase 2 fallback**: render the pill natively (Direct Composition) and drop the permanent webview. Only do this if the numbers force it.

---

## 4. Information architecture (pages and hierarchy)

Left sidebar, custom frameless window, about 880×600, resizable down to ~720×520.

```
Spitit
├── Home
├── History
├── Dictation
│   ├── Hotkeys
│   ├── Language
│   └── Microphone
├── Output & Sound
└── Settings
    ├── API Key
    ├── General
    └── About
```

### 4.1 Home
- Big status line: **"Ready. Hold Alt + LShift to speak."** (shows the user's actual combo)
- Stat cards: **Words today · Words this week · Avg words per dictation · Time saved** (words ÷ 40 wpm typing speed vs. actual speaking time).
- A small 7-day bar chart of words per day.
- "Last 3 transcriptions" with one-click copy.
- A warning banner only if something is broken: missing API key, mic unavailable, hotkey conflict.

### 4.2 History
- Searchable list, grouped by day, with the app it was dictated into (icon + name).
- Row: text preview, word count, language, copy, delete. Click opens the full text.
- Toggle "Keep history" and "Clear all". Default cap 500 entries (SQLite makes this cheap).

### 4.3 Dictation
- **Hotkeys:** hold combo and toggle combo, an Activation Mode switch (Hold / Toggle), and a "Record new combo" button with a live key display. Keep the validation from `validate_combo`.
- **Language:** the same list as now (Auto, English, **Hinglish**, Hindi, Hindi+English mix, + 9 others).
- **Microphone:** device list, a live level meter, and "System default". Falls back to default if the saved device is missing.

### 4.4 Output & Sound
Four toggles, as now: Auto-paste · Copy to clipboard · Notification · Sound. Plus a sound preview button and a volume slider.

### 4.5 Settings
- **API Key:** masked field, Test button, link to console.groq.com. Stored in Credential Manager.
- **General:** launch at Windows startup, silence threshold slider, reset pill position.
- **About:** version, links, and "Check for updates" (**GitHub build only**, see §9).

That's 5 sidebar items. Nothing else earns a page.

---

## 5. The pill (the signature feature)

### 5.1 Geometry and behavior
- Fully rounded capsule. Dark glass (`#111113`, subtle 1px border, soft shadow). Brand yellow `#FFD505` as accent.
- **Hidden by default.** Appears only on hotkey. Never shows on hover, never rests on screen.
- **Draggable anywhere**, including across monitors. Position remembered per monitor. Dragging does not trigger recording.
- Always on top, **no focus**, hidden from Alt+Tab and the taskbar.
- Default position: bottom-center of the active monitor, above the taskbar.

### 5.2 Layout
```
[ (app icon) ]  [ ........ content by state ........ ]
  left circle
```
- **Left:** a circle holding the **active window's icon**.
- **Right:** changes per state (below).

### 5.3 Active-app icon
- Listen for foreground changes (`SetWinEventHook` with `EVENT_SYSTEM_FOREGROUND`). No polling, so no CPU cost.
- Get the process exe → icon (`SHGetFileInfo`/`ExtractIconEx`); handle packaged/UWP apps separately.
- Cache icons by exe path.
- When the active window changes **while the pill is showing**, the icon **crossfades with a tiny scale (≈180 ms)**. It must never pop or flicker.
- If an icon can't be resolved, show a neutral mic glyph.
- This icon is also saved with each history entry.

### 5.4 States

| State | Right side | Edge | Motion |
|---|---|---|---|
| **Recording** | Live **waveform bars** reacting to mic level (RMS), smooth ~60 fps | **Shine travelling around the border** | Pill grows in with a spring |
| **Processing** | **Circular spinner** (arc) | Shine fades out, dim border | Bars morph into the ring |
| **Done** | **Tick draws itself** + "**12 words**" | Brief green flash on the border | Ring morphs into the tick |
| **Error** | Cross + short reason (no key, no mic, silence) | Brief red | Gentle shake |

**All transitions are morphs, not cuts.** Width, content and colour interpolate (spring ~300-400 ms). No element is ever hard-swapped.

### 5.5 The edge shine
Your "light moving on the edge" effect, built the lightweight way:
- A **conic-gradient** layer behind a 1.5px border mask, rotating via a CSS `@property --angle` animation (GPU composited, near-zero CPU).
- A bright yellow-white highlight that travels ~270° of the border with a soft tail, slowly speeding up with voice level.
- Only runs in the Recording state. Stops completely otherwise.

### 5.6 Lifecycle
- Done: stays ~900 ms, then shrinks and fades out.
- Error: ~2.5 s.
- The pill window is hidden (not destroyed) afterwards, so the next press is instant.

---

## 6. Hotkey behavior (the tricky part)

Use one global low-level hook. Rules:

1. **Hold mode:** recording starts when the combo is fully down and ends when it is released. Switching windows, Alt+Tab, or pressing extra keys while the combo is held must **not** stop it. Extra keys are ignored. Only **releasing a key of the combo** ends it.
2. **Toggle mode:** first press starts, **only the same combo pressed again stops it**. Changing tabs, apps or windows has no effect, even with hands off the keyboard.
3. **Modifier-only combos** (Alt+LShift) are supported. Debounce the Windows keyboard-layout switch (Alt+Shift) so it doesn't fire when the combo is used for Spitit.
4. **Do not swallow keys.** Pass events through (as now) so normal typing is never affected.
5. **Re-arm** the hook after sleep/wake and on a watchdog (same idea as 2.0.1, which you already fixed once).
6. The hook thread must be tiny and never block. It sends events to the core over a channel.
7. Max recording length 120 s with auto-stop, as now.
8. Pressing the hotkey while processing is ignored (no overlap). Esc during recording cancels.

---

## 7. App window and window behavior

- **Custom title bar** drawn in the UI: drag region, minimize / maximize / close buttons that match the theme. Keep **Windows 11 snap-layout** support on the maximize button.
- Rounded corners and **Mica/Acrylic** backdrop on Windows 11, with a solid dark fallback on Windows 10.
- **Close (X) = hide to tray**, and the webview is **destroyed** to free RAM. Quit only from the tray menu.
- **Launching again** (search, shortcut, installer) → existing instance shows the Home window. No duplicate tray icons, no second process.
- First run: 3-step onboarding in the same window: API key → hotkey + live mic test → "you're ready". The splash only shows on first run, **never** on Windows-startup launches (start silently in tray).

### Tray menu
Open Spitit · Switch mode (Hold/Toggle) · Copy last transcription · Quit.
Tray icon has a subtle recording indicator while active.

---

## 8. Motion, hover and sound design

**UI**
- Every interactive element has hover, pressed, focus and disabled states. Hover = subtle lift + brightness, 120-160 ms ease-out.
- Page transitions: short crossfade + 8 px slide. Cards stagger in once.
- Respect Windows "reduce animations" setting (`prefers-reduced-motion`).
- Colors unchanged: black/charcoal base, `#FFD505` accent, green `#3ddc84` done, blue `#4d9eff` processing, red `#ff5f5f` error.
- Font: Segoe UI Variable for the app (native feel); optional Space Grotesk for headings to match the website.

**Sound (original, not stock)**
- Generate it with the existing script approach (synthesis, so no licensing and nothing anyone has heard).
- **Start:** a soft, short rising two-note "glass tap" (~120 ms).
- **Done:** a warmer three-partial bell with a gentle pitch bloom and fast decay (~250 ms), more "satisfying" than the current C5+E5.
- Slightly detuned sine partials + a filtered noise transient for the "tap". Keep peak level low so it feels premium rather than loud.
- Both are bundled as tiny WAVs, with a volume setting.

---

## 9. Microsoft Store: why it failed and how to pass

### What most likely went wrong
1. **Rolling download link.** The Store needs an installer URL that is **versioned and never changes**. A `releases/latest` style link breaks certification.
2. **Unsigned EXE.** Submitting an `.exe` installer means you must supply a **code-signing certificate from a trusted CA**. That is the "get it certified" step you hit.
3. **External download button** on your website, as the reviewer told you.
4. **Self-updater inside the app.** Store apps must update through the Store.

### The fix
- **Submit MSIX, not EXE.** The Store signs MSIX packages for you. No certificate purchase.
- **Two build channels from one codebase** (compile-time flag):
  - `store`: MSIX, **no auto-updater, no "check for updates" button, no external download links in the app**.
  - `direct`: portable `.exe` + NSIS setup, with the GitHub updater.
- **Startup:** use the MSIX **StartupTask** manifest entry, not a registry Run key.
- **Capabilities:** `runFullTrust` (needed for the global hook) and microphone. Declare them honestly in the manifest.
- **Website:** for the Store version, use a **Get it from Microsoft** button linking to the Store page. Direct downloads can live on GitHub, but the *Store listing and review notes* must not point users to download a different build outside the Store. If in doubt, keep direct-download links off the main marketing page and only on the GitHub release page.
- **Privacy policy URL is mandatory**, since you record the microphone and send audio to a third party (Groq). The policy must say so plainly: audio goes to Groq, nothing goes to REREAL servers, and the key is stored locally.
- **Store listing text must match behavior.** Don't claim "no cloud" when audio goes to Groq. Say "no REREAL servers, no telemetry". Reviewers do read this.
- **Test credentials for the reviewer.** The app needs the user's own Groq key to work. In "Notes for certification", paste a **working test key** and the steps (Settings → API Key → hold Alt+LShift). Without it the app looks broken to a tester and gets rejected.
- **Age rating and category:** Productivity. No ads, no in-app purchases (Free).
- **Developer account:** as far as I know, individual Partner Center registration is now free, but please confirm the current price on the signup page before you go in.
- Check the current Store policies in Partner Center before final submit, since policy wording changes. I did not verify the exact policy numbers here.

### Packaging checklist
- [ ] Single-instance works under MSIX
- [ ] Hook + SendInput paste works under MSIX full-trust
- [ ] Credential Manager works under MSIX
- [ ] Store build has no updater and no external download links
- [ ] Run the **Windows App Certification Kit** locally and fix failures *before* submitting
- [ ] Test on a clean Windows 10 and Windows 11 VM

---

## 10. Build outputs (all formats you asked for)

| Format | Use | Channel |
|---|---|---|
| **MSIX** | Microsoft Store submission | `store` |
| **Portable `.exe`** | Run from anywhere, USB | `direct` |
| **NSIS `Setup.exe`** | Classic installer with shortcuts | `direct` |
| **`.msi`** (optional) | IT/enterprise installs | `direct` |
| **Run from source / dev** | Local use | dev |

Versions are single-sourced from one file. Release assets use **fixed, versioned file names**.

---

## 11. Build order for Antigravity

1. **Core spike (prove the risky parts first):** Tauri shell + LL hook (hold and toggle, modifier-only) + mic capture + Whisper call + clipboard paste. No UI polish yet.
2. **Pill:** no-focus window, states, morphs, shine, app icon tracking, drag.
3. **App shell:** frameless window, sidebar, Home, History (SQLite), Settings pages.
4. **Single instance + tray + startup + onboarding.**
5. **Sound design + notifications.**
6. **Measure RAM/CPU against §2.** Decide whether the native-pill fallback is needed.
7. **Channels + MSIX + App Cert Kit.**
8. **Store submission, then the website redesign pass.** The website still comes after, as planned.

### Non-goals (do not let these creep in)
- Dictionary, snippets, per-app tone, AI rewriting, notetaker, offline models, accounts/login, telemetry.
- Changing the Groq models or the Hinglish prompts.

---

## 12. Later (not v3)
- **Offline mode** with a local Whisper model (biggest privacy upside, but also the biggest size/RAM cost).
- Per-app language rules.
- Pill themes.

---

## 13. Things I'd double-check with you
- **Hold mode vs. Alt+Shift layout switching:** if you ever install a second Windows keyboard language, Alt+Shift will also switch layouts. Worth testing on your machine early, and picking a safer default combo if it conflicts.
- **B.Tech start:** you're about to start it, so the build order above is sized so steps 1-2 can be done as a demo first. That already gives you a strong portfolio piece before the Store review finishes.
