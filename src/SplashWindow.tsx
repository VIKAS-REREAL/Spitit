import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import iconSvg from "./assets/icon.svg";
import "./SplashWindow.css";

interface UserSettings {
  hotkey_preset?: string;
  mode?: string;
  language?: string;
}

export default function SplashWindow() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isAutostart, setIsAutostart] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const [progress, setProgress] = useState(100);
  const [isClosing, setIsClosing] = useState(false);
  const [paused, setPaused] = useState(false);

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

    // 3. Keyboard shortcuts: Enter / Space = Continue, S / O = Settings, Esc = Continue
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
    setTimeout(async () => {
      try {
        await invoke("splash_open_settings");
      } catch {
        // Fallback
        await invoke("open_settings_window").catch(() => {});
      }
    }, 140);
  };

  const handleContinueBackground = async () => {
    if (isClosing) return;
    setIsClosing(true);
    setPaused(true);
    setTimeout(async () => {
      try {
        await invoke("splash_continue_background");
      } catch {
        // Fallback close window
        await invoke("close_window").catch(() => {});
      }
    }, 140);
  };

  // Helper to parse hotkey labels into keyboard keycaps
  const renderKeycaps = () => {
    const raw = settings?.hotkey_preset || "ctrl_space";
    let keys: string[] = ["Ctrl", "Space"];

    switch (raw.toLowerCase()) {
      case "ctrl_space":
        keys = ["Ctrl", "Space"];
        break;
      case "right_alt":
      case "alt_right":
        keys = ["Right Alt"];
        break;
      case "left_alt":
      case "alt_left":
        keys = ["Left Alt"];
        break;
      case "caps_lock":
      case "capslock":
        keys = ["Caps Lock"];
        break;
      case "f8":
        keys = ["F8"];
        break;
      case "f9":
        keys = ["F9"];
        break;
      case "double_ctrl":
        keys = ["Ctrl", "Ctrl"];
        break;
      default:
        keys = raw.split("+").map((k) => k.trim());
        break;
    }

    return (
      <div className="splash-hotkey-pill">
        {keys.map((k, idx) => (
          <span key={idx} style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
            <kbd className="splash-kbd">{k}</kbd>
            {idx < keys.length - 1 && <span className="splash-kbd-plus">+</span>}
          </span>
        ))}
      </div>
    );
  };

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
              src={iconSvg}
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
          {renderKeycaps()}
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
            <span>Continue in Background</span>
          </button>

          {/* Secondary Action: Open Settings */}
          <button
            className="splash-btn splash-btn-secondary"
            onClick={handleOpenSettings}
            title="Open Spitit Settings & Dashboard"
          >
            <span className="splash-btn-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </span>
            <span>Open Settings</span>
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

