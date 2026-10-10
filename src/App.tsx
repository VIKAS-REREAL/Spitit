import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./App.css";

type NavTab = "dictation" | "api_key" | "language" | "sound" | "history" | "system";

interface HistoryItem {
  id: string;
  text: string;
  wordCount: number;
  wpm?: number;
  appName?: string;
  timestamp: string;
}

interface UserSettings {
  hotkey_combo: string;
  mode: string;
  language: string;
  auto_paste: boolean;
  play_sound: boolean;
  sound_volume: number;
  start_with_windows: boolean;
}

const COMBO_OPTIONS = [
  { id: "alt_shift", label: "Alt + Left Shift (Default)", badge: "Alt + Shift" },
  { id: "ctrl_space", label: "Ctrl + Space", badge: "Ctrl + Space" },
  { id: "alt_space", label: "Alt + Space", badge: "Alt + Space" },
  { id: "ctrl_shift", label: "Ctrl + Shift", badge: "Ctrl + Shift" },
  { id: "right_alt", label: "Right Alt (AltGr)", badge: "AltGr" },
];

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>("dictation");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string>("");
  const [keyStatusType, setKeyStatusType] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [mode, setMode] = useState("hold");
  const [hotkeyCombo, setHotkeyCombo] = useState<string>("alt_shift");
  const [language, setLang] = useState("hinglish");
  const [playSound, setPlaySound] = useState(true);
  const [soundVolume, setSoundVolume] = useState(70);
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [autoPaste, setAutoPaste] = useState(true);
  const [copyClipboard, setCopyClipboard] = useState(true);
  const [showNotification, setShowNotification] = useState(true);
  const [saveHistory, setSaveHistory] = useState<boolean>(() => {
    const saved = localStorage.getItem("spitit_save_history");
    return saved !== null ? saved === "true" : true;
  });

  const [historySearch, setHistorySearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testDictationText, setTestDictationText] = useState("");
  const [isManualRecording, setIsManualRecording] = useState(false);

  // Load history from localStorage if enabled
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem("spitit_history");
      if (raw) return JSON.parse(raw);
    } catch {}
    return [
      {
        id: "1",
        text: "yaar kal morning meeting mein presentation complete karke deliver karna hai",
        wordCount: 11,
        timestamp: "Today, 10:24 PM",
      },
      {
        id: "2",
        text: "The low latency voice pipeline handles high throughput dictation smoothly",
        wordCount: 10,
        timestamp: "Today, 09:42 PM",
      },
    ];
  });

  // Up-to-date refs to prevent unnecessary useEffect re-runs and slider lag
  const playSoundRef = useRef(playSound);
  const soundVolumeRef = useRef(soundVolume);
  const saveHistoryRef = useRef(saveHistory);

  useEffect(() => {
    playSoundRef.current = playSound;
  }, [playSound]);

  useEffect(() => {
    soundVolumeRef.current = soundVolume;
  }, [soundVolume]);

  useEffect(() => {
    saveHistoryRef.current = saveHistory;
  }, [saveHistory]);

  // Initial load on mount ONLY
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setShowSplash(false);
    }, 800);

    // Load stored key
    invoke<string>("get_api_key")
      .then((k) => {
        if (k) {
          setApiKey(k);
          setKeyStatusType("success");
          setKeyStatus("Connected & verified");
        } else {
          setKeyStatusType("idle");
          setKeyStatus("Enter your Groq key to activate voice dictation");
        }
      })
      .catch((e) => console.error("Failed to load key:", e));

    // Load full persisted settings from Rust backend
    invoke<UserSettings>("get_all_settings")
      .then((s) => {
        if (s) {
          if (s.hotkey_combo) setHotkeyCombo(s.hotkey_combo);
          if (s.mode) setMode(s.mode);
          if (s.language) setLang(s.language);
          if (s.auto_paste !== undefined) setAutoPaste(s.auto_paste);
          if (s.play_sound !== undefined) setPlaySound(s.play_sound);
          if (s.sound_volume !== undefined) setSoundVolume(s.sound_volume);
          if (s.start_with_windows !== undefined) setStartWithWindows(s.start_with_windows);
        }
      })
      .catch((e) => console.error("Failed to load settings:", e));

    // Listen for recording states from Rust
    const unlistenState = listen<string>("recording_state", (event) => {
      if (event.payload === "recording") {
        setIsManualRecording(true);
      } else {
        setIsManualRecording(false);
      }
    });

    // Listen for rich metadata with WPM and active app name
    const unlistenMeta = listen<{
      text: string;
      word_count: number;
      duration_secs: number;
      wpm: number;
      app_name: string;
    }>("transcript_meta", (event) => {
      const meta = event.payload;
      if (meta && meta.text) {
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          text: meta.text,
          wordCount: meta.word_count || meta.text.trim().split(/\s+/).length,
          wpm: meta.wpm,
          appName: meta.app_name,
          timestamp: "Just now",
        };

        if (saveHistoryRef.current) {
          setHistory((prev) => {
            const updated = [newItem, ...prev.slice(0, 99)];
            try {
              localStorage.setItem("spitit_history", JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }

        setTestDictationText(meta.text);

        // Play chime if enabled
        if (playSoundRef.current) {
          try {
            const audio = new Audio("/sound/done.wav");
            audio.volume = soundVolumeRef.current / 100;
            audio.play().catch(() => {});
          } catch {}
        }
      }
    });

    return () => {
      clearTimeout(splashTimer);
      unlistenState.then((f) => f());
      unlistenMeta.then((f) => f());
    };
  }, []);

  const syncSettings = (updates: Partial<UserSettings>) => {
    invoke<UserSettings>("get_all_settings")
      .then((cur) => {
        const merged = { ...cur, ...updates };
        invoke("save_all_settings", { newSettings: merged }).catch(() => {});
      })
      .catch(() => {});
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      setKeyStatusType("error");
      setKeyStatus("Please enter a valid Groq API key (starts with gsk_...)");
      return;
    }
    try {
      await invoke("save_api_key", { apiKey: apiKey.trim() });
      setKeyStatusType("success");
      setKeyStatus("Saved securely to Windows Credential Manager & AppData");
    } catch (e: any) {
      setKeyStatusType("error");
      setKeyStatus(`Save failed: ${e}`);
    }
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setKeyStatusType("error");
      setKeyStatus("Enter an API key first");
      return;
    }
    setKeyStatusType("testing");
    setKeyStatus("Testing connection to Groq Cloud...");
    try {
      const res = await invoke<string>("test_api_key", { apiKey: apiKey.trim() });
      setKeyStatusType("success");
      setKeyStatus(res);
      // Also ensure it is saved
      await invoke("save_api_key", { apiKey: apiKey.trim() });
    } catch (e: any) {
      setKeyStatusType("error");
      setKeyStatus(`Connection failed: ${e}`);
    }
  };

  const handleModeChange = async (newMode: string) => {
    setMode(newMode);
    syncSettings({ mode: newMode });
  };

  const handleHotkeyComboChange = async (newCombo: string) => {
    setHotkeyCombo(newCombo);
    syncSettings({ hotkey_combo: newCombo });
  };

  const handleLangChange = async (newLang: string) => {
    setLang(newLang);
    syncSettings({ language: newLang });
  };

  const handleAutostartChange = async (enabled: boolean) => {
    setStartWithWindows(enabled);
    syncSettings({ start_with_windows: enabled });
    try {
      await invoke("set_autostart_enabled", { enabled });
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlaySoundChange = (enabled: boolean) => {
    setPlaySound(enabled);
    syncSettings({ play_sound: enabled });
  };

  const handleSoundVolumeChange = (vol: number) => {
    setSoundVolume(vol);
    syncSettings({ sound_volume: vol });
  };

  const handleAutoPasteChange = (enabled: boolean) => {
    setAutoPaste(enabled);
    syncSettings({ auto_paste: enabled });
  };

  const handleSaveHistoryToggle = (enabled: boolean) => {
    setSaveHistory(enabled);
    localStorage.setItem("spitit_save_history", String(enabled));
    if (!enabled) {
      // If user disables history, clear persisted history from localStorage
      localStorage.removeItem("spitit_history");
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("spitit_history");
  };

  const playTestChime = () => {
    try {
      const audio = new Audio("/sound/done.wav");
      audio.volume = soundVolume / 100;
      audio.play().catch(() => {});
    } catch {}
  };

  const handleCopyHistory = (item: HistoryItem) => {
    navigator.clipboard.writeText(item.text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Toggle Sandbox Manual Recording
  const handleToggleSandboxRecord = async () => {
    try {
      if (!isManualRecording) {
        setIsManualRecording(true);
        await invoke("start_manual_record");
      } else {
        setIsManualRecording(false);
        const res = await invoke<string>("stop_manual_record");
        if (res) {
          setTestDictationText(res);
        }
      }
    } catch (e: any) {
      console.error(e);
      setIsManualRecording(false);
    }
  };

  // Windows Standard Window Controls via direct Rust IPC
  const handleClose = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke("close_window");
    } catch {
      const win = getCurrentWebviewWindow();
      await win.hide();
    }
  };

  const handleMinimize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke("minimize_window");
    } catch {
      const win = getCurrentWebviewWindow();
      await win.minimize();
    }
  };

  const handleMaximize = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await invoke("toggle_maximize_window");
    } catch {
      const win = getCurrentWebviewWindow();
      await win.toggleMaximize();
    }
  };

  // In-app hotkey detection so shortcuts trigger even when focused inside the app window
  useEffect(() => {
    const handleInAppKey = (e: KeyboardEvent) => {
      // Do not intercept if typing inside an input/textarea unless it's hotkey modifier
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");

      const alt = e.altKey;
      const shift = e.shiftKey;
      const ctrl = e.ctrlKey;
      const space = e.code === "Space";

      let matched = false;
      if (hotkeyCombo === "alt_shift" && alt && shift) matched = true;
      if (hotkeyCombo === "ctrl_space" && ctrl && space) matched = true;
      if (hotkeyCombo === "alt_space" && alt && space) matched = true;
      if (hotkeyCombo === "ctrl_shift" && ctrl && shift) matched = true;

      if (matched && (!isInput || space)) {
        e.preventDefault();
        handleToggleSandboxRecord();
      }
    };

    window.addEventListener("keydown", handleInAppKey);
    return () => window.removeEventListener("keydown", handleInAppKey);
  }, [hotkeyCombo, isManualRecording]);

  const currentBadge = COMBO_OPTIONS.find((c) => c.id === hotkeyCombo)?.badge || "Alt + Shift";

  const filteredHistory = history.filter((h) =>
    h.text.toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="win-app" onContextMenu={(e) => e.preventDefault()}>
      {/* Splash Screen */}
      {showSplash && (
        <div className="win-splash-screen">
          <div className="win-splash-content">
            <img src="/icon.svg" alt="Spitit" className="win-splash-icon" />
            <h1 className="win-splash-title">Spitit</h1>
            <p className="win-splash-sub">High-Speed Voice Dictation</p>
            <div className="win-splash-loader">
              <div className="win-splash-loader-bar" />
            </div>
          </div>
        </div>
      )}

      {/* Standard Windows Titlebar with Controls on Right */}
      <header className="win-titlebar">
        <div className="win-titlebar-left" data-tauri-drag-region>
          <img src="/icon.svg" alt="Spitit" className="win-titlebar-icon" />
          <span className="win-titlebar-name">Spitit</span>
          <span className="win-titlebar-badge">v3.0</span>
        </div>

        <div className="win-titlebar-spacer" data-tauri-drag-region />

        <div className="win-titlebar-right">
          <span className="win-shortcut-badge" title="Active Global Hotkey">
            {currentBadge}
          </span>

          <div className="win-controls" onMouseDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="win-btn minimize"
              onClick={handleMinimize}
              title="Minimize"
              aria-label="Minimize"
            >
              <svg width="10" height="1" viewBox="0 0 10 1">
                <rect width="10" height="1" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="win-btn maximize"
              onClick={handleMaximize}
              title="Maximize / Restore"
              aria-label="Maximize"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1" />
              </svg>
            </button>
            <button
              type="button"
              className="win-btn close"
              onClick={handleClose}
              title="Close to System Tray"
              aria-label="Close"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="win-body">
        {/* Modern Sidebar with Real SVG Icons */}
        <aside className="win-sidebar">
          <div className="win-sidebar-brand">
            <div className="win-brand-icon-wrap">
              <img src="/icon.svg" alt="Spitit" className="win-brand-icon" />
            </div>
            <div className="win-brand-meta">
              <span className="win-brand-title">Spitit</span>
              <span className="win-brand-desc">Local Dictation</span>
            </div>
          </div>

          <nav className="win-sidebar-nav">
            <button
              className={`win-nav-item ${activeTab === "dictation" ? "active" : ""}`}
              onClick={() => setActiveTab("dictation")}
            >
              <span className="win-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
              </span>
              <span className="win-nav-label">Dictation</span>
            </button>

            <button
              className={`win-nav-item ${activeTab === "api_key" ? "active" : ""}`}
              onClick={() => setActiveTab("api_key")}
            >
              <span className="win-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7.5" cy="15.5" r="5.5" />
                  <path d="m21 2-9.6 9.6" />
                  <path d="m15.5 7.5 3 3L22 7l-3-3" />
                </svg>
              </span>
              <span className="win-nav-label">API Key</span>
              {!apiKey && <span className="win-nav-badge-warn">!</span>}
            </button>

            <button
              className={`win-nav-item ${activeTab === "language" ? "active" : ""}`}
              onClick={() => setActiveTab("language")}
            >
              <span className="win-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </span>
              <span className="win-nav-label">Language</span>
            </button>

            <button
              className={`win-nav-item ${activeTab === "sound" ? "active" : ""}`}
              onClick={() => setActiveTab("sound")}
            >
              <span className="win-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              </span>
              <span className="win-nav-label">Sound & Feedback</span>
            </button>

            <button
              className={`win-nav-item ${activeTab === "history" ? "active" : ""}`}
              onClick={() => setActiveTab("history")}
            >
              <span className="win-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </span>
              <span className="win-nav-label">History</span>
              {history.length > 0 && (
                <span className="win-nav-badge-count">{history.length}</span>
              )}
            </button>

            <button
              className={`win-nav-item ${activeTab === "system" ? "active" : ""}`}
              onClick={() => setActiveTab("system")}
            >
              <span className="win-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <span className="win-nav-label">System</span>
            </button>
          </nav>

          <div className="win-sidebar-footer">
            <span className="win-hotkey-label">Active Trigger</span>
            <span className="win-hotkey-val">{currentBadge}</span>
          </div>
        </aside>

        {/* Content Area with Custom Dark Scrollbar */}
        <main className="win-main custom-scrollbar">
          {/* TAB 1: DICTATION */}
          {activeTab === "dictation" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Voice Dictation</h2>
                <p>Customize trigger hotkeys, activation modes, and test voice transcription.</p>
              </div>

              {/* Activation Mode Card */}
              <div className="win-card">
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Activation Mode</h3>
                    <p className="win-card-desc">
                      Hold mode records while keys are held down. Toggle mode starts on first press and stops on second press.
                    </p>
                  </div>
                  <div className="win-toggle-group">
                    <button
                      className={`win-toggle-btn ${mode === "hold" ? "active" : ""}`}
                      onClick={() => handleModeChange("hold")}
                    >
                      Hold Mode
                    </button>
                    <button
                      className={`win-toggle-btn ${mode === "toggle" ? "active" : ""}`}
                      onClick={() => handleModeChange("toggle")}
                    >
                      Toggle Mode
                    </button>
                  </div>
                </div>

                <div className="win-divider" />

                {/* Customizable Global Hotkey Presets */}
                <div className="win-card-row vertical">
                  <div>
                    <h3 className="win-card-title">Global Trigger Combination</h3>
                    <p className="win-card-desc">
                      Choose your preferred global shortcut. Works universally across Notepad, VS Code, Browser, Word, etc.
                    </p>
                  </div>

                  <div className="win-hotkey-grid">
                    {COMBO_OPTIONS.map((c) => (
                      <button
                        key={c.id}
                        className={`win-hotkey-option ${hotkeyCombo === c.id ? "active" : ""}`}
                        onClick={() => handleHotkeyComboChange(c.id)}
                      >
                        <span className="win-option-check">
                          {hotkeyCombo === c.id ? "✓" : "○"}
                        </span>
                        <span className="win-option-label">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Interactive Voice Sandbox with Test Button */}
              <div className="win-card">
                <div className="win-card-header-action">
                  <div>
                    <h3 className="win-card-title">Interactive Voice Sandbox</h3>
                    <p className="win-card-desc">
                      Test dictation right here in the app using your hotkey or click the test button below.
                    </p>
                  </div>
                  <button
                    className={`win-btn-action ${isManualRecording ? "recording" : "primary"}`}
                    onClick={handleToggleSandboxRecord}
                  >
                    {isManualRecording ? "■ Stop & Transcribe" : "🎙️ Test Record Now"}
                  </button>
                </div>

                <div className="win-sandbox-wrap">
                  <textarea
                    className="win-sandbox-textarea custom-scrollbar"
                    rows={4}
                    placeholder={`Speak using ${currentBadge} or click Test Record... Your transcribed text appears here automatically.`}
                    value={testDictationText}
                    onChange={(e) => setTestDictationText(e.target.value)}
                  />
                  <div className="win-sandbox-footer">
                    <span className="win-words-count">
                      {testDictationText.trim() ? testDictationText.trim().split(/\s+/).length : 0} words
                    </span>
                    <button
                      className="win-btn-secondary small"
                      onClick={() => setTestDictationText("")}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: API KEY */}
          {activeTab === "api_key" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Groq API Key</h2>
                <p>Spitit uses Groq Whisper Large v3 Turbo for ultra-fast, ultra-accurate cloud transcription.</p>
              </div>

              <div className="win-card">
                <div className="win-form-group">
                  <label className="win-label">Groq Cloud API Key</label>
                  <div className="win-input-wrap">
                    <input
                      type={showKey ? "text" : "password"}
                      className="win-input"
                      placeholder="gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                    <button
                      className="win-input-action"
                      onClick={() => setShowKey(!showKey)}
                      title={showKey ? "Hide key" : "Show key"}
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  <span className="win-hint">
                    Key is persisted in Windows Credential Manager and local AppData storage.
                  </span>
                </div>

                {keyStatus && (
                  <div className={`win-status-box ${keyStatusType}`}>
                    <span className="win-box-icon">
                      {keyStatusType === "success" && "✓"}
                      {keyStatusType === "error" && "✕"}
                      {keyStatusType === "testing" && "⟳"}
                      {keyStatusType === "idle" && "ℹ"}
                    </span>
                    <span className="win-box-text">{keyStatus}</span>
                  </div>
                )}

                <div className="win-card-actions">
                  <button className="win-btn-secondary" onClick={handleTestKey}>
                    Test Connection
                  </button>
                  <button className="win-btn-primary" onClick={handleSaveKey}>
                    Save API Key
                  </button>
                </div>
              </div>

              <div className="win-info-card">
                <h4>Where do I get a Groq API key?</h4>
                <p>
                  1. Visit <strong>console.groq.com</strong> and create a free account.<br />
                  2. Navigate to <strong>API Keys</strong> and generate a new key.<br />
                  3. Paste it here. Groq provides generous free tier credits for Whisper v3.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: LANGUAGE */}
          {activeTab === "language" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Transcription Language</h2>
                <p>Select your speech recognition model and optimization mode.</p>
              </div>

              <div className="win-card">
                <div className="win-radio-grid">
                  {[
                    { id: "hinglish", name: "Hinglish (Recommended)", desc: "Natural Hindi + English mix in Roman script. LLM post-processed." },
                    { id: "en", name: "English Only", desc: "Fastest standard transcription optimized for pure English speech." },
                    { id: "auto", name: "Auto Detect", desc: "Whisper automatically identifies the spoken language." },
                    { id: "hi", name: "Hindi (Devanagari)", desc: "Transcribes Hindi audio into native Devanagari script." },
                    { id: "mixed_hi_en", name: "Mixed Hindi + English", desc: "Hindi in Devanagari, English words preserved in English." },
                    { id: "es", name: "Spanish", desc: "Native Spanish speech recognition." },
                    { id: "fr", name: "French", desc: "Native French speech recognition." },
                    { id: "de", name: "German", desc: "Native German speech recognition." },
                  ].map((l) => (
                    <div
                      key={l.id}
                      className={`win-radio-card ${language === l.id ? "selected" : ""}`}
                      onClick={() => handleLangChange(l.id)}
                    >
                      <div className="win-radio-header">
                        <span className="win-radio-title">{l.name}</span>
                        {language === l.id && <span className="win-radio-check">✓</span>}
                      </div>
                      <span className="win-radio-desc">{l.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SOUND & FEEDBACK */}
          {activeTab === "sound" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Sound & Feedback</h2>
                <p>Customize audio chimes, volume levels, and visual feedback.</p>
              </div>

              <div className="win-card">
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Completion Sound</h3>
                    <p className="win-card-desc">Play a pleasant soft chime when dictation transcription finishes.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={playSound}
                      onChange={(e) => handlePlaySoundChange(e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Chime Volume</h3>
                    <p className="win-card-desc">Adjust audio volume level for completion chimes.</p>
                  </div>
                  <div className="win-slider-wrap">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={soundVolume}
                      onChange={(e) => handleSoundVolumeChange(Number(e.target.value))}
                      className="win-range"
                    />
                    <span className="win-slider-val">{soundVolume}%</span>
                    <button className="win-btn-secondary small" onClick={playTestChime}>
                      Preview
                    </button>
                  </div>
                </div>

                <div className="win-divider" />

                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Desktop Notifications</h3>
                    <p className="win-card-desc">Show subtle toast alerts when transcription errors occur.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={showNotification}
                      onChange={(e) => setShowNotification(e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HISTORY & PRIVACY */}
          {activeTab === "history" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Dictation History & Privacy</h2>
                <p>Review, search, or toggle saving history to keep your transcription strictly in clipboard.</p>
              </div>

              {/* Privacy Toggle Card */}
              <div className="win-card">
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Save History in Application</h3>
                    <p className="win-card-desc">
                      When turned off, transcripts stay in clipboard only and are never saved to disk.
                    </p>
                  </div>
                  <div className="win-history-toggle-wrap">
                    <label className="win-switch">
                      <input
                        type="checkbox"
                        checked={saveHistory}
                        onChange={(e) => handleSaveHistoryToggle(e.target.checked)}
                      />
                      <span className="win-slider" />
                    </label>
                  </div>
                </div>

                <div className="win-divider" />

                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Clear Dictation History</h3>
                    <p className="win-card-desc">Remove all cached voice transcripts from this machine.</p>
                  </div>
                  <button className="win-btn-secondary small danger" onClick={handleClearHistory}>
                    Clear History Now
                  </button>
                </div>
              </div>

              {/* History Search & List */}
              <div className="win-card">
                <div className="win-history-toolbar">
                  <input
                    type="text"
                    className="win-search-input"
                    placeholder="Search transcripts..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                  />
                  <span className="win-history-counter">
                    {filteredHistory.length} items
                  </span>
                </div>

                <div className="win-history-list custom-scrollbar">
                  {filteredHistory.length === 0 ? (
                    <div className="win-empty-history">
                      <p>
                        {saveHistory
                          ? "No transcription history yet. Use your hotkey to dictate anywhere."
                          : "History saving is disabled. Transcriptions are placed directly into clipboard."}
                      </p>
                    </div>
                  ) : (
                    filteredHistory.map((item) => (
                      <div key={item.id} className="win-history-item">
                        <div className="win-history-content">
                          <p className="win-history-text">{item.text}</p>
                          <div className="win-history-meta">
                            {item.appName && (
                              <>
                                <span className="win-hist-app-tag">{item.appName}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{item.wordCount} words</span>
                            {item.wpm && item.wpm > 0 ? (
                              <>
                                <span>•</span>
                                <span className="win-hist-wpm-tag">{item.wpm} WPM</span>
                              </>
                            ) : null}
                            <span>•</span>
                            <span>{item.timestamp}</span>
                          </div>
                        </div>
                        <button
                          className="win-btn-copy"
                          onClick={() => handleCopyHistory(item)}
                          title="Copy to clipboard"
                        >
                          {copiedId === item.id ? "Copied! ✓" : "Copy"}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SYSTEM */}
          {activeTab === "system" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>System & Behavior</h2>
                <p>Configure startup behavior, auto-paste integration, and application performance.</p>
              </div>

              <div className="win-card">
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Launch on Windows Startup</h3>
                    <p className="win-card-desc">Automatically run Spitit minimized to system tray on login.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={startWithWindows}
                      onChange={(e) => handleAutostartChange(e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Auto-Paste into Active App</h3>
                    <p className="win-card-desc">Simulate Ctrl+V immediately after transcription completes.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={autoPaste}
                      onChange={(e) => handleAutoPasteChange(e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Always Copy to Clipboard</h3>
                    <p className="win-card-desc">Ensure transcribed text is saved in clipboard for manual pasting.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={copyClipboard}
                      onChange={(e) => setCopyClipboard(e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>
              </div>

              <div className="win-info-card">
                <h4>About Spitit v3.0</h4>
                <p>
                  REREAL Spitit v3 is designed with native Win32 performance, instant registry startup, zero external subprocess lag, and high-speed Groq Whisper cloud processing.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
