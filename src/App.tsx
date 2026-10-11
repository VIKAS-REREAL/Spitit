import React, { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./App.css";

type NavTab = "dashboard" | "dictation" | "api_key" | "language" | "sound" | "history" | "system";

interface HistoryRecord {
  id: number;
  text: string;
  word_count: number;
  duration_secs: number;
  wpm: number;
  app_name: string;
  app_icon: string | null;
  language: string;
  timestamp_ms: number;
  formatted_date: string;
}

interface DailyActivity {
  day: string;
  date: string;
  words: number;
  is_today: boolean;
}

interface DashboardStats {
  total_words: number;
  words_today: number;
  words_this_week: number;
  avg_wpm: number;
  time_saved_mins: number;
  avg_words_per_dictation: number;
  daily_activity: DailyActivity[];
  top_apps: [string, number][];
  today_audio_seconds: number;
  total_dictations: number;
  is_empty: boolean;
}

interface AudioDeviceInfo {
  name: string;
  is_default: boolean;
}

interface ValidationResult {
  tier: "blocked" | "warning" | "ok";
  reason: string;
}

interface UserSettings {
  hotkey_combo: string;
  hold_hotkey: string;
  toggle_hotkey: string;
  mode: string;
  language: string;
  auto_paste: boolean;
  copy_to_clipboard: boolean;
  play_sound: boolean;
  sound_volume: number;
  start_with_windows: boolean;
  pill_edge_animation: boolean;
  minimum_hold_time_ms: number;
  silence_threshold: number;
  microphone_device: string;
  save_history: boolean;
  keep_stats: boolean;
  onboarding_completed: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  hotkey_combo: "alt_shift",
  hold_hotkey: "Alt+LShift",
  toggle_hotkey: "Ctrl+Space",
  mode: "hold",
  language: "en",
  auto_paste: true,
  copy_to_clipboard: true,
  play_sound: true,
  sound_volume: 70,
  start_with_windows: false,
  pill_edge_animation: true,
  minimum_hold_time_ms: 250,
  silence_threshold: 0.0015,
  microphone_device: "System default",
  save_history: true,
  keep_stats: true,
  onboarding_completed: false,
};

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);

  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string>("");
  const [keyStatusType, setKeyStatusType] = useState<"idle" | "testing" | "success" | "error">("idle");

  // Dashboard Stats & History state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Hardware & Windows state
  const [micList, setMicList] = useState<AudioDeviceInfo[]>([]);
  const [liveMicLevel, setLiveMicLevel] = useState<number>(0);
  const [isClipHistoryOn, setIsClipHistoryOn] = useState<boolean>(true);

  // Hotkey recording & validation state
  const [isRecordingCombo, setIsRecordingCombo] = useState<"hold" | "toggle" | null>(null);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Onboarding wizard state (Section 4.6)
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [onboardingStep, setOnboardingStep] = useState<number>(1);

  // Dictation test sandbox
  const [testDictationText, setTestDictationText] = useState("");
  const [isDictating, setIsDictating] = useState(false);

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Initial load
  useEffect(() => {
    const splashTimer = setTimeout(() => setShowSplash(false), 800);

    // 1. Load API key
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
      .catch(() => {});

    // 2. Load Settings
    invoke<UserSettings>("get_all_settings")
      .then((s) => {
        if (s) {
          setSettings(s);
          if (!s.onboarding_completed) {
            setShowOnboarding(true);
          }
        }
      })
      .catch(() => {});

    // 3. Load Dashboard Stats
    loadStats();

    // 4. Load SQLite History & Migrate old localStorage items
    migrateOldLocalStorageHistory();
    loadHistory();

    // 5. Query Windows Clipboard History status & Microphone list
    invoke<boolean>("is_clipboard_history_enabled")
      .then((enabled) => setIsClipHistoryOn(enabled))
      .catch(() => {});

    invoke<AudioDeviceInfo[]>("list_mics")
      .then((mics) => setMicList(mics))
      .catch(() => {});

    // 6. Event listeners
    const unlistenLevel = listen<number>("mic_level", (event) => {
      setLiveMicLevel(event.payload || 0);
    });

    const unlistenState = listen<string>("recording_state", (event) => {
      setIsDictating(event.payload === "recording");
    });

    const unlistenMeta = listen<HistoryRecord>("transcript_meta", (event) => {
      if (event.payload?.text) {
        setTestDictationText(event.payload.text);
        // Refresh dashboard & history
        loadStats();
        loadHistory();
      }
    });

    const unlistenLang = listen<string>("language_changed", (event) => {
      if (event.payload) {
        setSettings((prev) => ({ ...prev, language: event.payload }));
      }
    });

    return () => {
      clearTimeout(splashTimer);
      unlistenLevel.then((f) => f());
      unlistenState.then((f) => f());
      unlistenMeta.then((f) => f());
      unlistenLang.then((f) => f());
    };
  }, []);

  const loadStats = () => {
    invoke<DashboardStats>("get_dashboard_stats")
      .then((res) => setStats(res))
      .catch(() => {});
  };

  const loadHistory = (query?: string) => {
    invoke<HistoryRecord[]>("get_history", { search: query ?? historySearch, limit: 100 })
      .then((records) => setHistory(records))
      .catch(() => {});
  };

  // Clean migration of old localStorage history (Section 4.8)
  const migrateOldLocalStorageHistory = () => {
    try {
      const raw = localStorage.getItem("spitit_history");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Discard or clean old fake demo items
          localStorage.removeItem("spitit_history");
        }
      }
    } catch {}
  };

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    invoke("save_all_settings", { newSettings: next }).catch(() => {});
  };

  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      setKeyStatusType("error");
      setKeyStatus("Please enter an API key first.");
      return;
    }
    setKeyStatusType("testing");
    setKeyStatus("Testing connection to Groq API...");
    try {
      const res = await invoke<string>("test_api_key", { apiKey: apiKey.trim() });
      setKeyStatusType("success");
      setKeyStatus(res || "Connection verified!");
    } catch (err: any) {
      setKeyStatusType("error");
      setKeyStatus(err || "Connection failed.");
    }
  };

  const handleSaveKey = async () => {
    try {
      await invoke("save_api_key", { apiKey: apiKey.trim() });
      setKeyStatusType("success");
      setKeyStatus("API Key securely saved in Windows Credential Manager.");
    } catch (err: any) {
      setKeyStatusType("error");
      setKeyStatus(`Failed to save: ${err}`);
    }
  };

  // Hotkey recording handlers
  const startRecordingCombo = (target: "hold" | "toggle") => {
    setIsRecordingCombo(target);
    setRecordedKeys([]);
    setValidation(null);
  };

  const handleKeyDownRecorder = (e: React.KeyboardEvent) => {
    if (!isRecordingCombo) return;
    e.preventDefault();
    e.stopPropagation();

    const keyName = e.key;
    if (keyName === "Escape") {
      setIsRecordingCombo(null);
      setRecordedKeys([]);
      setValidation(null);
      return;
    }

    const current: string[] = [];
    if (e.altKey) current.push("Alt");
    if (e.ctrlKey) current.push("Ctrl");
    if (e.shiftKey) current.push("Shift");

    let mainKey = e.code.replace(/^(Key|Digit)/, "");
    if (mainKey === "Space") mainKey = "Space";
    if (
      !["Alt", "Control", "Shift", "Meta"].includes(keyName) &&
      !current.includes(mainKey)
    ) {
      current.push(mainKey);
    }

    if (current.length > 0) {
      setRecordedKeys(current);
      const comboStr = current.join("+");
      const other =
        isRecordingCombo === "hold" ? settings.toggle_hotkey : settings.hold_hotkey;

      invoke<ValidationResult>("validate_hotkey", {
        combo: comboStr,
        isHold: isRecordingCombo === "hold",
        otherCombo: other,
      })
        .then((res) => setValidation(res))
        .catch(() => {});
    }
  };

  const commitRecordedCombo = () => {
    if (!isRecordingCombo || recordedKeys.length === 0) return;
    if (validation && validation.tier === "blocked") return;

    const comboStr = recordedKeys.join("+");
    if (isRecordingCombo === "hold") {
      updateSetting("hold_hotkey", comboStr);
    } else {
      updateSetting("toggle_hotkey", comboStr);
    }
    setIsRecordingCombo(null);
    setRecordedKeys([]);
    setValidation(null);
  };

  const handleResetHotkeys = () => {
    updateSetting("hold_hotkey", "Alt+LShift");
    updateSetting("toggle_hotkey", "Ctrl+Space");
  };

  const handleCopyHistory = (item: HistoryRecord) => {
    navigator.clipboard.writeText(item.text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDeleteHistoryItem = async (id: number) => {
    await invoke("delete_history_item", { id });
    loadHistory();
  };

  const handleClearHistory = async () => {
    await invoke("clear_history");
    loadHistory();
  };

  const handleResetStats = async () => {
    await invoke("reset_stats");
    loadStats();
  };

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

  const openWindowsSettings = (uri: string) => {
    invoke("open_windows_settings", { uri }).catch(() => {});
  };

  const finishOnboarding = () => {
    setShowOnboarding(false);
    updateSetting("onboarding_completed", true);
  };

  const activeHotkeyDisplay =
    settings.mode === "hold" ? settings.hold_hotkey : settings.toggle_hotkey;

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

      {/* Onboarding Wizard Modal (Section 4.6) */}
      {showOnboarding && (
        <div className="win-onboarding-overlay">
          <div className="win-onboarding-modal">
            <div className="win-onboarding-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src="/icon.svg" alt="Spitit" width="22" height="22" />
                <h3 style={{ fontSize: "15px", fontWeight: 600, color: "#fff" }}>
                  Welcome to Spitit v3
                </h3>
              </div>
              <div className="win-onboarding-steps">
                {[1, 2, 3, 4, 5, 6].map((step) => (
                  <span
                    key={step}
                    className={`win-step-dot ${onboardingStep === step ? "active" : ""} ${
                      onboardingStep > step ? "completed" : ""
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="win-onboarding-body">
              {/* Step 1: Welcome & Features */}
              {onboardingStep === 1 && (
                <div>
                  <h2 style={{ fontSize: "18px", color: "#fff", marginBottom: 6 }}>
                    Instant Speech-to-Text Anywhere
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--win-text-secondary)", marginBottom: 16 }}>
                    Spitit enables seamless voice dictation directly into Notepad, VS Code, Slack,
                    WhatsApp, and any Windows application without manual typing.
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#FFD505", marginBottom: 4 }}>
                        🎙️ Hold or Toggle
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--win-text-secondary)" }}>
                        Hold your shortcut while speaking, release to paste instantly.
                      </div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#34C759", marginBottom: 4 }}>
                        ⚡ Sub-Second Speed
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--win-text-secondary)" }}>
                        Whisper Large v3 Turbo on Groq cloud processes audio in milliseconds.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Groq API Key */}
              {onboardingStep === 2 && (
                <div>
                  <h2 style={{ fontSize: "18px", color: "#fff", marginBottom: 6 }}>
                    Connect Your Groq API Key
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--win-text-secondary)", marginBottom: 14 }}>
                    Spitit uses your private Groq key stored only in Windows Credential Manager.
                    Free keys are available at{" "}
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--win-accent)" }}
                    >
                      console.groq.com
                    </a>.
                  </p>
                  <div className="win-input-wrap" style={{ marginBottom: 12 }}>
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
                    >
                      {showKey ? "Hide" : "Show"}
                    </button>
                  </div>
                  {keyStatus && (
                    <div className={`win-status-box ${keyStatusType}`} style={{ marginBottom: 12 }}>
                      <span className="win-box-text">{keyStatus}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="win-btn-secondary" onClick={handleTestKey}>
                      Test Connection
                    </button>
                    <button className="win-btn-primary" onClick={handleSaveKey}>
                      Save Key
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Hotkey Selection & Try it Now */}
              {onboardingStep === 3 && (
                <div>
                  <h2 style={{ fontSize: "18px", color: "#fff", marginBottom: 6 }}>
                    Trigger Hotkey
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--win-text-secondary)", marginBottom: 14 }}>
                    Your active shortcut is <strong>{activeHotkeyDisplay}</strong> ({settings.mode} mode).
                  </p>
                  <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                    <button
                      className={`win-toggle-btn ${settings.mode === "hold" ? "active" : ""}`}
                      onClick={() => updateSetting("mode", "hold")}
                    >
                      Hold Mode ({settings.hold_hotkey})
                    </button>
                    <button
                      className={`win-toggle-btn ${settings.mode === "toggle" ? "active" : ""}`}
                      onClick={() => updateSetting("mode", "toggle")}
                    >
                      Toggle Mode ({settings.toggle_hotkey})
                    </button>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span style={{ fontSize: "12px", color: "var(--win-text-secondary)" }}>
                      Try it now: Hold <strong>{activeHotkeyDisplay}</strong>, say something, and release!
                    </span>
                    <div style={{ marginTop: 8, color: "#fff", fontSize: "13px", minHeight: 24 }}>
                      {testDictationText || (isDictating ? "🎙️ Listening..." : "Dictated text will show here.")}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Microphone Permission & Live Test */}
              {onboardingStep === 4 && (
                <div>
                  <h2 style={{ fontSize: "18px", color: "#fff", marginBottom: 6 }}>
                    Microphone & Permissions
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--win-text-secondary)", marginBottom: 14 }}>
                    Spitit opens the microphone on press and closes it when recording ends.
                  </p>
                  <div style={{ marginBottom: 14 }}>
                    <label className="win-label">Active Input Device</label>
                    <select
                      className="win-select"
                      value={settings.microphone_device}
                      onChange={(e) => updateSetting("microphone_device", e.target.value)}
                    >
                      <option value="System default">System default</option>
                      {micList.map((m) => (
                        <option key={m.name} value={m.name}>
                          {m.name} {m.is_default ? "(Default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ padding: 12, borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div style={{ fontSize: "12px", color: "var(--win-text-secondary)", marginBottom: 8 }}>
                      Live Input Level (Speak to test):
                    </div>
                    <div className="win-meter-bg">
                      <div
                        className="win-meter-fill"
                        style={{ width: `${Math.round(liveMicLevel * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Clipboard History Check */}
              {onboardingStep === 5 && (
                <div>
                  <h2 style={{ fontSize: "18px", color: "#fff", marginBottom: 6 }}>
                    Windows Clipboard History (Win+V)
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--win-text-secondary)", marginBottom: 14 }}>
                    Spitit places transcripts in your clipboard. Enabling Windows Clipboard History
                    ensures previously copied links or images are never lost.
                  </p>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 8,
                      background: isClipHistoryOn ? "rgba(52,199,89,0.08)" : "rgba(255,159,10,0.08)",
                      border: `1px solid ${isClipHistoryOn ? "rgba(52,199,89,0.25)" : "rgba(255,159,10,0.25)"}`,
                      marginBottom: 14,
                    }}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 600, color: isClipHistoryOn ? "#34c759" : "#ff9f0a" }}>
                      {isClipHistoryOn ? "✓ Clipboard History is enabled" : "⚠️ Clipboard History is currently off"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--win-text-secondary)", marginTop: 4 }}>
                      {isClipHistoryOn
                        ? "Press Win+V anytime in Windows to view past copied items."
                        : "Turn it on in Windows Settings so past clipboard items remain preserved."}
                    </div>
                  </div>
                  {!isClipHistoryOn && (
                    <button
                      className="win-btn-secondary"
                      onClick={() => openWindowsSettings("ms-settings:clipboard")}
                    >
                      Open Windows Clipboard Settings
                    </button>
                  )}
                </div>
              )}

              {/* Step 6: Ready */}
              {onboardingStep === 6 && (
                <div>
                  <h2 style={{ fontSize: "18px", color: "#fff", marginBottom: 6 }}>
                    You're All Set!
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--win-text-secondary)", marginBottom: 16 }}>
                    Spitit is running silently in your system tray. Whenever you need to type, just:
                  </p>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 18,
                      borderRadius: 8,
                      background: "rgba(255,213,5,0.08)",
                      border: "1px solid rgba(255,213,5,0.2)",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "#FFD505",
                      letterSpacing: "0.02em",
                      marginBottom: 16,
                    }}
                  >
                    Hold {activeHotkeyDisplay} & Speak
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--win-text-secondary)" }}>
                    You can reopen this setup guide or customize options anytime in Settings.
                  </p>
                </div>
              )}
            </div>

            <div className="win-onboarding-footer">
              <button
                className="win-btn-secondary"
                onClick={finishOnboarding}
                style={{ fontSize: "12px" }}
              >
                Skip Setup
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                {onboardingStep > 1 && (
                  <button
                    className="win-btn-secondary"
                    onClick={() => setOnboardingStep((s) => s - 1)}
                  >
                    Back
                  </button>
                )}
                {onboardingStep < 6 ? (
                  <button
                    className="win-btn-primary"
                    onClick={() => setOnboardingStep((s) => s + 1)}
                  >
                    Next →
                  </button>
                ) : (
                  <button className="win-btn-primary" onClick={finishOnboarding}>
                    Get Started ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Windows 11 Titlebar */}
      <header className="win-titlebar">
        <div className="win-titlebar-left">
          <img src="/icon.svg" alt="Spitit" className="win-titlebar-icon" />
          <span className="win-titlebar-name">Spitit</span>
          <span className="win-titlebar-badge">v3.0</span>
        </div>

        <div className="win-titlebar-spacer" />

        <div className="win-titlebar-right">
          <span className="win-shortcut-badge" title="Active Global Hotkey">
            {activeHotkeyDisplay}
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

      {/* Main Body: Sidebar + Panes */}
      <div className="win-body">
        {/* Sidebar */}
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
              className={`win-nav-item ${activeTab === "dashboard" ? "active" : ""}`}
              onClick={() => setActiveTab("dashboard")}
            >
              <span className="win-nav-icon">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="9" />
                  <rect x="14" y="3" width="7" height="5" />
                  <rect x="14" y="12" width="7" height="9" />
                  <rect x="3" y="16" width="7" height="5" />
                </svg>
              </span>
              <span className="win-nav-label">Dashboard</span>
            </button>

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
              <span className="win-nav-label">Sound & Pill</span>
            </button>

            <button
              className={`win-nav-item ${activeTab === "history" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("history");
                loadHistory();
              }}
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
            <span className="win-hotkey-val">{activeHotkeyDisplay}</span>
          </div>
        </aside>

        {/* Content Pane */}
        <main className="win-main custom-scrollbar">
          {/* TAB 0: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Overview & Insights</h2>
                <p>Real-time speech analytics powered by local SQLite usage data.</p>
              </div>

              {/* Hero Status Card */}
              <div className="win-hero-card">
                <div className="win-hero-left">
                  <div className="win-hero-dot" />
                  <div>
                    <div className="win-hero-title">Voice Engine Ready</div>
                    <div className="win-hero-sub">
                      Hold <strong>{activeHotkeyDisplay}</strong> to speak anywhere.
                    </div>
                  </div>
                </div>
                <div className="win-hero-badges">
                  <span className="win-hero-badge gold">
                    {settings.language === "hinglish" ? "Hinglish (AI)" : "English (Fast)"}
                  </span>
                  <span className="win-hero-badge">
                    {settings.mode === "hold" ? "Hold Mode" : "Toggle Mode"}
                  </span>
                </div>
              </div>

              {/* Honest Empty State if zero dictations (Section 2.4 & 4.8) */}
              {stats?.is_empty ? (
                <div className="win-dashboard-empty">
                  <h3>No Dictations Recorded Yet</h3>
                  <p>
                    Press <strong>{activeHotkeyDisplay}</strong> to speak anywhere in Windows. Your
                    words, speaking speed (WPM), and app statistics will appear here in real-time.
                  </p>
                </div>
              ) : (
                <>
                  {/* 4 Core Real Stat Cards */}
                  <div className="win-stats-grid">
                    <div className="win-stat-card">
                      <div className="win-stat-header">
                        <span>Total Words</span>
                        <span className="win-stat-icon">📝</span>
                      </div>
                      <div className="win-stat-val accent">{stats?.total_words || 0}</div>
                      <div className="win-stat-sub">Dictated through Spitit</div>
                    </div>

                    <div className="win-stat-card">
                      <div className="win-stat-header">
                        <span>Words Today</span>
                        <span className="win-stat-icon">⚡</span>
                      </div>
                      <div className="win-stat-val">{stats?.words_today || 0}</div>
                      <div className="win-stat-sub">Active session volume</div>
                    </div>

                    <div className="win-stat-card">
                      <div className="win-stat-header">
                        <span>Speaking Speed</span>
                        <span className="win-stat-icon">🎙️</span>
                      </div>
                      <div className="win-stat-val">
                        {stats?.avg_wpm || 0}{" "}
                        <span style={{ fontSize: "13px", fontWeight: 500 }}>WPM</span>
                      </div>
                      <div className="win-stat-sub">From actual speaking time</div>
                    </div>

                    <div className="win-stat-card">
                      <div className="win-stat-header">
                        <span>Time Saved</span>
                        <span className="win-stat-icon">⏳</span>
                      </div>
                      <div className="win-stat-val accent">
                        {stats?.time_saved_mins || 0}{" "}
                        <span style={{ fontSize: "13px", fontWeight: 500 }}>mins</span>
                      </div>
                      <div className="win-stat-sub">Estimated vs 40 WPM typing</div>
                    </div>
                  </div>

                  {/* Real 7-Day Velocity Chart */}
                  <div className="win-chart-card">
                    <div className="win-chart-header">
                      <span className="win-chart-title">7-Day Voice Volume</span>
                      <span className="win-chart-legend">Words per day (real calendar dates)</span>
                    </div>
                    <div className="win-chart-bars">
                      {stats?.daily_activity &&
                        stats.daily_activity.map((d) => {
                          const maxW = Math.max(
                            ...stats.daily_activity.map((item) => item.words),
                            50,
                          );
                          const heightPercent = Math.min(
                            100,
                            Math.max(12, Math.round((d.words / maxW) * 100)),
                          );
                          return (
                            <div key={d.day} className="win-bar-col" title={`${d.day}: ${d.words} words`}>
                              <div
                                className={`win-bar-fill ${d.is_today ? "active" : ""}`}
                                style={{ height: `${heightPercent}%` }}
                              />
                              <span className={`win-bar-label ${d.is_today ? "active" : ""}`}>{d.day}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Today's Audio Usage Meter (Section 4.3) */}
                  <div className="win-usage-card">
                    <div className="win-usage-header">
                      <span style={{ fontWeight: 600, color: "#fff" }}>Today's Audio Usage</span>
                      <span style={{ color: "var(--win-text-tertiary)" }}>
                        {((stats?.today_audio_seconds || 0) / 60).toFixed(1)} mins today
                      </span>
                    </div>
                    <div className="win-meter-bg">
                      <div
                        className="win-meter-fill"
                        style={{
                          width: `${Math.min(100, Math.round(((stats?.today_audio_seconds || 0) / 3600) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* 2-Column Split: Top Apps Breakdown + Recent Transcriptions */}
                  <div className="win-split-grid">
                    {/* Top Apps */}
                    <div className="win-split-card">
                      <div className="win-split-header">
                        <span className="win-split-title">Top Active Applications</span>
                        <span style={{ fontSize: "11px", color: "var(--win-text-tertiary)" }}>By usage</span>
                      </div>
                      <div className="win-apps-list">
                        {stats?.top_apps && stats.top_apps.length > 0 ? (
                          stats.top_apps.map(([appName, count]) => {
                            const pct = Math.round(
                              (count / Math.max(stats.total_dictations, 1)) * 100,
                            );
                            return (
                              <div key={appName} className="win-app-row">
                                <div className="win-app-meta">
                                  <span className="win-app-name">{appName}</span>
                                  <span className="win-app-count">{count} dictations</span>
                                </div>
                                <div className="win-app-bar-bg">
                                  <div className="win-app-bar-fill" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div style={{ color: "var(--win-text-tertiary)", fontSize: "12px", padding: "10px 0" }}>
                            Dictate into any app to see app tracking breakdown.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recent Transcriptions */}
                    <div className="win-split-card">
                      <div className="win-split-header">
                        <span className="win-split-title">Recent Transcriptions</span>
                        <button className="win-split-link" onClick={() => setActiveTab("history")}>
                          View all →
                        </button>
                      </div>
                      <div className="win-recent-list">
                        {history.slice(0, 3).map((item) => (
                          <div key={item.id} className="win-recent-item">
                            <span className="win-recent-text" title={item.text}>
                              {item.text}
                            </span>
                            <div className="win-recent-meta">
                              <span style={{ fontSize: "10.5px", color: "var(--win-text-tertiary)" }}>
                                {item.word_count}w
                              </span>
                              <button
                                className="win-btn-copy"
                                onClick={() => handleCopyHistory(item)}
                              >
                                {copiedId === item.id ? "✓" : "Copy"}
                              </button>
                            </div>
                          </div>
                        ))}
                        {history.length === 0 && (
                          <div style={{ color: "var(--win-text-tertiary)", fontSize: "12px", padding: "10px 0" }}>
                            No transcriptions yet. Press your hotkey to start speaking!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 1: DICTATION */}
          {activeTab === "dictation" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Voice Dictation & Hotkeys</h2>
                <p>Configure custom shortcuts, activation modes, and hold threshold.</p>
              </div>

              {/* Mode Selection */}
              <div className="win-card">
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Activation Mode</h3>
                    <p className="win-card-desc">
                      Hold mode records while pressed. Toggle mode starts on first press and stops on second press.
                    </p>
                  </div>
                  <div className="win-toggle-group">
                    <button
                      className={`win-toggle-btn ${settings.mode === "hold" ? "active" : ""}`}
                      onClick={() => updateSetting("mode", "hold")}
                    >
                      Hold Mode
                    </button>
                    <button
                      className={`win-toggle-btn ${settings.mode === "toggle" ? "active" : ""}`}
                      onClick={() => updateSetting("mode", "toggle")}
                    >
                      Toggle Mode
                    </button>
                  </div>
                </div>

                <div className="win-divider" />

                {/* Hold Mode Combo Config */}
                <div className="win-card-row vertical">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 className="win-card-title">Hold Mode Shortcut</h3>
                      <p className="win-card-desc">Used when Activation Mode is set to Hold.</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span className="win-shortcut-badge">{settings.hold_hotkey}</span>
                      <button
                        className="win-btn-secondary small"
                        onClick={() => startRecordingCombo("hold")}
                      >
                        {isRecordingCombo === "hold" ? "Recording..." : "Change Shortcut"}
                      </button>
                    </div>
                  </div>

                  {isRecordingCombo === "hold" && (
                    <div
                      tabIndex={0}
                      onKeyDown={handleKeyDownRecorder}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        background: "rgba(255,213,5,0.06)",
                        border: "1px dashed var(--win-accent)",
                        outline: "none",
                        marginTop: 10,
                      }}
                    >
                      <div style={{ fontSize: "12px", color: "var(--win-text-secondary)", marginBottom: 6 }}>
                        Press your shortcut combination (e.g. Alt+LShift, Ctrl+Space, RightAlt):
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                        {recordedKeys.length > 0 ? recordedKeys.join(" + ") : "Listening for keys..."}
                      </div>

                      {validation && (
                        <div className={`win-validation-box ${validation.tier}`}>
                          <span>
                            {validation.tier === "blocked" && "⛔ Blocked: "}
                            {validation.tier === "warning" && "⚠️ Warning: "}
                            {validation.tier === "ok" && "✓ OK: "}
                            {validation.reason}
                          </span>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          className="win-btn-primary small"
                          disabled={!validation || validation.tier === "blocked"}
                          onClick={commitRecordedCombo}
                        >
                          Save Shortcut
                        </button>
                        <button
                          className="win-btn-secondary small"
                          onClick={() => setIsRecordingCombo(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="win-divider" />

                {/* Toggle Mode Combo Config */}
                <div className="win-card-row vertical">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 className="win-card-title">Toggle Mode Shortcut</h3>
                      <p className="win-card-desc">Used when Activation Mode is set to Toggle.</p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <span className="win-shortcut-badge">{settings.toggle_hotkey}</span>
                      <button
                        className="win-btn-secondary small"
                        onClick={() => startRecordingCombo("toggle")}
                      >
                        {isRecordingCombo === "toggle" ? "Recording..." : "Change Shortcut"}
                      </button>
                    </div>
                  </div>

                  {isRecordingCombo === "toggle" && (
                    <div
                      tabIndex={0}
                      onKeyDown={handleKeyDownRecorder}
                      style={{
                        padding: 14,
                        borderRadius: 8,
                        background: "rgba(255,213,5,0.06)",
                        border: "1px dashed var(--win-accent)",
                        outline: "none",
                        marginTop: 10,
                      }}
                    >
                      <div style={{ fontSize: "12px", color: "var(--win-text-secondary)", marginBottom: 6 }}>
                        Press your shortcut combination:
                      </div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#fff", marginBottom: 6 }}>
                        {recordedKeys.length > 0 ? recordedKeys.join(" + ") : "Listening for keys..."}
                      </div>

                      {validation && (
                        <div className={`win-validation-box ${validation.tier}`}>
                          <span>
                            {validation.tier === "blocked" && "⛔ Blocked: "}
                            {validation.tier === "warning" && "⚠️ Warning: "}
                            {validation.tier === "ok" && "✓ OK: "}
                            {validation.reason}
                          </span>
                        </div>
                      )}

                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        <button
                          className="win-btn-primary small"
                          disabled={!validation || validation.tier === "blocked"}
                          onClick={commitRecordedCombo}
                        >
                          Save Shortcut
                        </button>
                        <button
                          className="win-btn-secondary small"
                          onClick={() => setIsRecordingCombo(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="win-divider" />

                {/* Minimum Hold Time Slider (Section 4.4) */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Minimum Hold Time (Tap Threshold)</h3>
                    <p className="win-card-desc">
                      Taps shorter than this are ignored to prevent accidental triggers (no pill, no API call).
                    </p>
                  </div>
                  <div className="win-slider-wrap">
                    <input
                      type="range"
                      min="100"
                      max="600"
                      step="25"
                      value={settings.minimum_hold_time_ms}
                      onChange={(e) => updateSetting("minimum_hold_time_ms", Number(e.target.value))}
                      className="win-range"
                      style={{
                        background: `linear-gradient(to right, #FFD505 0%, #FFD505 ${((settings.minimum_hold_time_ms - 100) / 500) * 100}%, rgba(255, 255, 255, 0.15) ${((settings.minimum_hold_time_ms - 100) / 500) * 100}%, rgba(255, 255, 255, 0.15) 100%)`,
                      }}
                    />
                    <span className="win-slider-val">{settings.minimum_hold_time_ms} ms</span>
                  </div>
                </div>

                <div className="win-divider" />

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button className="win-btn-secondary small" onClick={handleResetHotkeys}>
                    Reset Shortcuts to Default
                  </button>
                </div>
              </div>

              {/* Sandbox Tester */}
              <div className="win-card">
                <div className="win-card-header-action">
                  <div>
                    <h3 className="win-card-title">Voice Dictation Sandbox</h3>
                    <p className="win-card-desc">
                      Test dictating here using your shortcut. Text pastes automatically.
                    </p>
                  </div>
                </div>

                <div className="win-sandbox-wrap">
                  <textarea
                    className="win-sandbox-textarea custom-scrollbar"
                    rows={4}
                    placeholder={`Hold ${activeHotkeyDisplay} and speak... Your transcribed text will appear here.`}
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
                <p>Stored securely only in Windows Credential Manager. Zero plain-text files on disk.</p>
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
                    Key is persisted in Windows Credential Manager with hardware security.
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
                <h4>Getting a Free Groq Key:</h4>
                <p>
                  1. Visit <strong>console.groq.com</strong> and sign up.<br />
                  2. Navigate to <strong>API Keys</strong> and create a key.<br />
                  3. Paste it here. Groq provides generous free-tier limits for Whisper Turbo.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: LANGUAGE */}
          {activeTab === "language" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Language & AI Normalization</h2>
                <p>Choose transcription mode and optional Hinglish AI romanization.</p>
              </div>

              <div className="win-card">
                <div className="win-radio-grid">
                  {[
                    { id: "en", name: "English (Default & Fast)", desc: "Direct Whisper v3 Turbo transcription with sub-second speed. Recommended." },
                    { id: "hinglish", name: "Hinglish (AI Enhanced)", desc: "Natural Hindi + English mixed speech in Roman script. Cleaned with LLaMA 3.1." },
                    { id: "auto", name: "Auto Detect", desc: "Whisper automatically identifies language." },
                    { id: "hi", name: "Hindi (Devanagari)", desc: "Transcribes Hindi audio into native Devanagari script (हिन्दी)." },
                    { id: "mixed_hi_en", name: "Mixed Hindi + English", desc: "Hindi in Devanagari, English words in Latin script." },
                    { id: "es", name: "Spanish", desc: "Native Spanish speech recognition." },
                    { id: "fr", name: "French", desc: "Native French speech recognition." },
                    { id: "de", name: "German", desc: "Native German speech recognition." },
                  ].map((l) => (
                    <div
                      key={l.id}
                      className={`win-radio-card ${settings.language === l.id ? "selected" : ""}`}
                      onClick={() => updateSetting("language", l.id)}
                    >
                      <div className="win-radio-header">
                        <span className="win-radio-title">{l.name}</span>
                        {settings.language === l.id && <span className="win-radio-check">✓</span>}
                      </div>
                      <span className="win-radio-desc">{l.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: SOUND & PILL */}
          {activeTab === "sound" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>Sound & Pill Aesthetics</h2>
                <p>Configure audio feedback and rotating edge light animations.</p>
              </div>

              <div className="win-card">
                {/* Completion Sound Toggle */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Completion & Start Sound</h3>
                    <p className="win-card-desc">Play soft chimes on recording start and completion.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={settings.play_sound}
                      onChange={(e) => updateSetting("play_sound", e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                {/* Chime Volume */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Chime Volume</h3>
                    <p className="win-card-desc">Adjust audio volume level for feedback sounds.</p>
                  </div>
                  <div className="win-slider-wrap">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={settings.sound_volume}
                      onChange={(e) => updateSetting("sound_volume", Number(e.target.value))}
                      className="win-range"
                      style={{
                        background: `linear-gradient(to right, #FFD505 0%, #FFD505 ${settings.sound_volume}%, rgba(255, 255, 255, 0.15) ${settings.sound_volume}%, rgba(255, 255, 255, 0.15) 100%)`,
                      }}
                    />
                    <span className="win-slider-val">{settings.sound_volume}%</span>
                    <button
                      className="win-btn-secondary small"
                      onClick={() => {
                        try {
                          const a = new Audio("/sound/done.wav");
                          a.volume = settings.sound_volume / 100;
                          a.play();
                        } catch {}
                      }}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                <div className="win-divider" />

                {/* Pill Edge Animation Toggle (Section 4.1) */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Pill Edge Animation</h3>
                    <p className="win-card-desc">
                      Show rotating light beam around the pill border while recording.
                    </p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={settings.pill_edge_animation}
                      onChange={(e) => updateSetting("pill_edge_animation", e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                {/* Reset Pill Position Button (Section 3.2) */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Reset Pill Position</h3>
                    <p className="win-card-desc">
                      Center the floating pill at bottom-center of active monitor.
                    </p>
                  </div>
                  <button
                    className="win-btn-secondary small"
                    onClick={() => invoke("reset_pill_position").catch(() => {})}
                  >
                    Reset Position
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HISTORY & PRIVACY */}
          {activeTab === "history" && (
            <div className="win-pane">
              <div className="win-pane-header">
                <h2>History & Privacy (SQLite)</h2>
                <p>Decoupled text history and anonymous usage stats storage.</p>
              </div>

              <div className="win-card">
                {/* Save History Toggle (Section 4.8 A) */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Save Text History (Max 500)</h3>
                    <p className="win-card-desc">
                      When turned off, transcript text is never saved to disk and stays only in clipboard.
                    </p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={settings.save_history}
                      onChange={(e) => updateSetting("save_history", e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                {/* Keep Stats Toggle (Section 4.8 B) */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Keep Usage Stats (Numbers Only)</h3>
                    <p className="win-card-desc">
                      Stores word counts and durations to power the dashboard. Never stores words or text.
                    </p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={settings.keep_stats}
                      onChange={(e) => updateSetting("keep_stats", e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Database Management</h3>
                    <p className="win-card-desc">Clear local text history or reset anonymous usage metrics.</p>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="win-btn-secondary small danger" onClick={handleClearHistory}>
                      Clear Text History
                    </button>
                    <button className="win-btn-secondary small" onClick={handleResetStats}>
                      Reset Stats
                    </button>
                  </div>
                </div>
              </div>

              {/* Search & List */}
              <div className="win-card">
                <div className="win-history-toolbar">
                  <input
                    type="text"
                    className="win-search-input"
                    placeholder="Search transcripts..."
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      loadHistory(e.target.value);
                    }}
                  />
                  <span className="win-history-counter">{history.length} items</span>
                </div>

                <div className="win-history-list custom-scrollbar">
                  {history.length === 0 ? (
                    <div className="win-empty-history">
                      <p>
                        {settings.save_history
                          ? "No transcript history recorded yet. Hold your shortcut to speak anywhere."
                          : "History saving is disabled. Transcripts go directly into clipboard."}
                      </p>
                    </div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="win-history-item">
                        <div className="win-history-content">
                          <p className="win-history-text">{item.text}</p>
                          <div className="win-history-meta">
                            {item.app_name && (
                              <>
                                <span className="win-hist-app-tag">{item.app_name}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{item.word_count} words</span>
                            {item.wpm > 0 && (
                              <>
                                <span>•</span>
                                <span className="win-hist-wpm-tag">{item.wpm} WPM</span>
                              </>
                            )}
                            <span>•</span>
                            <span>{item.formatted_date}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button
                            className="win-btn-copy"
                            onClick={() => handleCopyHistory(item)}
                            title="Copy to clipboard"
                          >
                            {copiedId === item.id ? "Copied! ✓" : "Copy"}
                          </button>
                          <button
                            className="win-btn-secondary small"
                            onClick={() => handleDeleteHistoryItem(item.id)}
                            title="Delete entry"
                            style={{ padding: "4px 8px" }}
                          >
                            ✕
                          </button>
                        </div>
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
                <h2>System & Integrations</h2>
                <p>Configure startup behavior, auto-paste, and microphone devices.</p>
              </div>

              <div className="win-card">
                {/* Startup with Windows */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Launch on Windows Startup</h3>
                    <p className="win-card-desc">Starts silently in system tray without opening windows or splash.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={settings.start_with_windows}
                      onChange={(e) => {
                        const val = e.target.checked;
                        updateSetting("start_with_windows", val);
                        invoke("set_autostart_enabled", { enabled: val }).catch(() => {});
                      }}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                {/* Auto-Paste */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Auto-Paste into Active App</h3>
                    <p className="win-card-desc">Simulate Ctrl+V immediately after transcription finishes.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={settings.auto_paste}
                      onChange={(e) => updateSetting("auto_paste", e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                {/* Always Copy to Clipboard */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Always Copy to Clipboard</h3>
                    <p className="win-card-desc">Ensures text is retained in clipboard for manual pasting.</p>
                  </div>
                  <label className="win-switch">
                    <input
                      type="checkbox"
                      checked={settings.copy_to_clipboard}
                      onChange={(e) => updateSetting("copy_to_clipboard", e.target.checked)}
                    />
                    <span className="win-slider" />
                  </label>
                </div>

                <div className="win-divider" />

                {/* Windows Clipboard History Status Check */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Windows Clipboard History (Win+V)</h3>
                    <p className="win-card-desc">
                      Status:{" "}
                      <strong style={{ color: isClipHistoryOn ? "#34c759" : "#ff9f0a" }}>
                        {isClipHistoryOn ? "Enabled" : "Disabled in Windows"}
                      </strong>
                    </p>
                  </div>
                  <button
                    className="win-btn-secondary small"
                    onClick={() => openWindowsSettings("ms-settings:clipboard")}
                  >
                    Configure in Windows Settings
                  </button>
                </div>

                <div className="win-divider" />

                {/* Microphone Selection & Live Test */}
                <div className="win-card-row vertical">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 className="win-card-title">Microphone Device</h3>
                      <p className="win-card-desc">Select capture device or system default.</p>
                    </div>
                    <button
                      className="win-btn-secondary small"
                      onClick={() => openWindowsSettings("ms-settings:sound")}
                    >
                      Windows Sound Settings
                    </button>
                  </div>

                  <select
                    className="win-select"
                    value={settings.microphone_device}
                    onChange={(e) => updateSetting("microphone_device", e.target.value)}
                    style={{ marginTop: 8 }}
                  >
                    <option value="System default">System default</option>
                    {micList.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.name} {m.is_default ? "(Default)" : ""}
                      </option>
                    ))}
                  </select>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: "11.5px", color: "var(--win-text-secondary)", marginBottom: 6 }}>
                      Microphone Live Input Meter:
                    </div>
                    <div className="win-meter-bg">
                      <div
                        className="win-meter-fill"
                        style={{ width: `${Math.round(liveMicLevel * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="win-divider" />

                {/* Reopen Onboarding */}
                <div className="win-card-row">
                  <div>
                    <h3 className="win-card-title">Setup & Onboarding Guide</h3>
                    <p className="win-card-desc">Revisit the first-time setup guide and feature tour.</p>
                  </div>
                  <button
                    className="win-btn-secondary small"
                    onClick={() => {
                      setOnboardingStep(1);
                      setShowOnboarding(true);
                    }}
                  >
                    Replay Onboarding
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
