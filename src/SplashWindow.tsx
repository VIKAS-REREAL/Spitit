import { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import iconSvg from "./assets/icon.svg";
import "./SplashWindow.css";

interface UserSettings {
  hotkey_preset?: number | string;
  hold_hotkey?: string;
  toggle_hotkey?: string;
  hotkey_combo?: string;
  mode?: string;
  language?: string;
}

/**
 * Safely resolves the active hotkey keycaps without ever throwing.
 * Handles numeric preset IDs (0..5), legacy strings, or custom combos.
 */
function getHotkeyKeycaps(settings: UserSettings | null): string[] {
  if (!settings) {
    return ["Alt", "Shift"];
  }

  // 1. Numeric Hotkey Preset IDs (matching App.tsx HOTKEY_PRESETS):
  // 0: Alt + Space
  // 1: Alt + Left Shift (Spitit Classic default)
  // 2: Ctrl + Shift
  // 3: Right Alt
  // 4: Ctrl + Alt + Space
  // 5: Ctrl + Space
  const presetNum =
    typeof settings.hotkey_preset === "number"
      ? settings.hotkey_preset
      : typeof settings.hotkey_preset === "string" && !isNaN(Number(settings.hotkey_preset))
        ? Number(settings.hotkey_preset)
        : null;

  if (presetNum !== null) {
    switch (presetNum) {
      case 0:
        return ["Alt", "Space"];
      case 1:
        return ["Alt", "Shift"];
      case 2:
        return ["Ctrl", "Shift"];
      case 3:
        return ["Right Alt"];
      case 4:
        return ["Ctrl", "Alt", "Space"];
      case 5:
        return ["Ctrl", "Space"];
      default:
        return ["Alt", "Shift"];
    }
  }

  // 2. String representation fallback (hold_hotkey or hotkey_combo)
  const raw = String(settings.hold_hotkey || settings.hotkey_combo || "").trim();
  if (raw) {
    const lower = raw.toLowerCase();
    if (lower.includes("space") && lower.includes("ctrl") && lower.includes("alt")) {
      return ["Ctrl", "Alt", "Space"];
    }
    if (lower.includes("space") && lower.includes("alt")) {
      return ["Alt", "Space"];
    }
    if (lower.includes("space") && lower.includes("ctrl")) {
      return ["Ctrl", "Space"];
    }
    if (lower.includes("ralt") || lower.includes("right alt")) {
      return ["Right Alt"];
    }
    if (lower.includes("ctrl") && lower.includes("shift")) {
      return ["Ctrl", "Shift"];
    }
    if (lower.includes("alt") && lower.includes("shift")) {
      return ["Alt", "Shift"];
    }
    const parts = raw.split(/[+_]/).map((k) => k.trim()).filter(Boolean);
    if (parts.length > 0) return parts;
  }

  return ["Alt", "Shift"];
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class SplashErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("SplashWindow uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="splash-container">
          <div className="splash-card">
            <div className="splash-drag-area" data-tauri-drag-region>
              <img
                src="/icon.svg"
                alt="Spitit"
                className="splash-logo-svg"
                data-tauri-drag-region
              />
              <div className="splash-title-row" data-tauri-drag-region>
                <span className="splash-app-name" data-tauri-drag-region>
                  Spitit
                </span>
                <span className="splash-version-badge" data-tauri-drag-region>
                  v3.0.1
                </span>
              </div>
              <div className="splash-tagline" data-tauri-drag-region>
                Instant AI Voice Dictation
              </div>
            </div>

            <div className="splash-actions" style={{ marginTop: "auto" }}>
              <button
                className="splash-btn splash-btn-primary"
                onClick={() => invoke("splash_continue_background").catch(() => {})}
              >
                <span>Continue in Background</span>
              </button>
              <button
                className="splash-btn splash-btn-secondary"
                onClick={() => invoke("splash_open_settings").catch(() => {})}
              >
                <span>Open Settings</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function SplashContent() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isAutostart, setIsAutostart] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>(iconSvg || "/icon.svg");

  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    // 1. Fetch user settings for hotkey hint
    invoke<UserSettings>("get_all_settings")
      .then((s) => {
        if (s) setSettings(s);
      })
      .catch(() => {});

    // 2. Check if this is an autostart boot launch
    invoke<boolean>("is_autostart_boot")
      .then((autostart) => {
        setIsAutostart(autostart);
      })
      .catch(() => {});

    // 3. Global keyboard shortcuts: Enter / Space / Esc = Continue, S / O = Settings
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") {
        handleContinueBackground();
      } else if (e.key.toLowerCase() === "s" || e.key.toLowerCase() === "o") {
        handleOpenSettings();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Handle Autostart countdown timer (4 seconds)
  useEffect(() => {
    if (!isAutostart || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const durationMs = 4000;
    startTimeRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, durationMs - elapsed);
      const remainingSecs = Math.ceil(remaining / 1000);

      setCountdown(remainingSecs);
      setProgress((remaining / durationMs) * 100);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        handleContinueBackground();
      }
    }, 50);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAutostart, paused]);

  const handleOpenSettings = async () => {
    if (isClosing) return;
    setIsClosing(true);
    setPaused(true);
    try {
      await invoke("splash_open_settings");
    } catch {
      await invoke("open_settings_window").catch(() => {});
    }
  };

  const handleContinueBackground = async () => {
    if (isClosing) return;
    setIsClosing(true);
    setPaused(true);
    try {
      await invoke("splash_continue_background");
    } catch {
      await invoke("close_window").catch(() => {});
    }
  };

  const keycaps = getHotkeyKeycaps(settings);

  return (
    <div className="splash-container">
      <div
        className={`splash-card ${isClosing ? "closing" : ""}`}
        onMouseEnter={() => setPaused(true)}
      >
        <div className="splash-ambient-flare" />

        {/* Draggable Header & Logo Area */}
        <div className="splash-drag-area" data-tauri-drag-region>
          <div className="splash-logo-wrapper" data-tauri-drag-region>
            <div className="splash-logo-glow" />
            <img
              src={imgSrc}
              onError={() => setImgSrc("/icon.svg")}
              alt="Spitit"
              className="splash-logo-svg"
              draggable={false}
              data-tauri-drag-region
            />
          </div>

          {/* Soundwave equalizer bars animation */}
          <div className="splash-soundwave" data-tauri-drag-region>
            <div className="splash-wave-bar" />
            <div className="splash-wave-bar" />
            <div className="splash-wave-bar" />
            <div className="splash-wave-bar" />
            <div className="splash-wave-bar" />
            <div className="splash-wave-bar" />
            <div className="splash-wave-bar" />
          </div>

          {/* Brand Title */}
          <div className="splash-title-row" data-tauri-drag-region>
            <span className="splash-app-name" data-tauri-drag-region>
              Spitit
            </span>
            <span className="splash-version-badge" data-tauri-drag-region>
              v3.0.1
            </span>
          </div>

          <div className="splash-tagline" data-tauri-drag-region>
            Hold it, press it, spit it. Instant AI Voice Dictation.
          </div>
        </div>

        {/* Hotkey & Active Status Pill */}
        <div className="splash-status-card" data-tauri-drag-region>
          <div className="splash-status-left" data-tauri-drag-region>
            <div className="splash-status-dot-ping" />
            <span className="splash-status-text">Ready in background</span>
          </div>
          <div className="splash-hotkey-pill">
            {keycaps.map((k, idx) => (
              <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                <kbd className="splash-kbd">{k}</kbd>
                {idx < keycaps.length - 1 && <span className="splash-kbd-plus">+</span>}
              </span>
            ))}
          </div>
        </div>

        {/* Autostart Countdown Banner (When launched during Windows startup) */}
        {isAutostart && (
          <div className="splash-autostart-banner">
            <div className="splash-autostart-header">
              <span className="splash-autostart-label">Windows Startup</span>
              <span className="splash-autostart-seconds">
                {paused ? "Paused" : `Continuing in ${countdown}s`}
              </span>
            </div>
            <div className="splash-progress-track">
              <div
                className="splash-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="splash-actions">
          {/* Primary Action: Continue in Background */}
          <button
            className="splash-btn splash-btn-primary"
            onClick={handleContinueBackground}
            title="Keep Spitit running in background (Hotkeys active)"
          >
            <span className="splash-btn-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
            <span>Continue in Background</span>
            <kbd className="splash-btn-kbd">Enter</kbd>
          </button>

          {/* Secondary Action: Open Settings */}
          <button
            className="splash-btn splash-btn-secondary"
            onClick={handleOpenSettings}
            title="Open Spitit Settings & Dashboard"
          >
            <span className="splash-btn-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span>Open Settings</span>
            <kbd className="splash-btn-kbd">S</kbd>
          </button>
        </div>

        {/* Footer Hint */}
        <div className="splash-footer" data-tauri-drag-region>
          Always accessible from your Windows System Tray
        </div>
      </div>
    </div>
  );
}

export default function SplashWindow() {
  return (
    <SplashErrorBoundary>
      <SplashContent />
    </SplashErrorBoundary>
  );
}
