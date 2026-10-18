import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./components/TrayPopup.css";

interface UserSettings {
  language: string;
}

export default function TrayPopupWindow() {
  const [language, setLanguage] = useState<string>("en");

  // Load language state on mount and listen to changes
  useEffect(() => {
    invoke<UserSettings>("get_all_settings")
      .then((s) => {
        if (s?.language) {
          setLanguage(s.language);
        }
      })
      .catch(() => {});

    const unlistenLang = listen<string>("language_changed", (event) => {
      setLanguage(event.payload);
    });

    // Auto-hide when focus is lost (clicking outside the tray menu)
    const onBlur = () => {
      invoke("hide_tray_popup").catch(() => {});
    };
    window.addEventListener("blur", onBlur);

    return () => {
      unlistenLang.then((fn) => fn());
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const handleSelectLanguage = async (newLang: string) => {
    setLanguage(newLang);
    try {
      await invoke("set_app_language", { language: newLang });
    } catch {}
    await invoke("hide_tray_popup").catch(() => {});
  };

  const handleOpenSettings = async () => {
    await invoke("hide_tray_popup").catch(() => {});
    await invoke("open_settings_window").catch(() => {});
  };

  const handleQuit = async () => {
    await invoke("exit_app").catch(() => {});
  };

  return (
    <div className="tray-popup-container">
      <div className="tray-popup-card">
        {/* Header */}
        <div className="tray-popup-header">
          <div className="tray-popup-title-group">
            <div className="tray-popup-logo-pill" />
            <span className="tray-popup-title">Spitit v3</span>
          </div>
          <span className="tray-popup-status">Ready</span>
        </div>

        <div className="tray-popup-divider" />

        {/* Language Options */}
        <div className="tray-popup-section-label">Language Mode</div>
        <button
          className="tray-popup-item"
          onClick={() => handleSelectLanguage("en")}
        >
          <div className="tray-popup-item-left">
            <span className="tray-popup-item-icon">🌐</span>
            <span>English (Fast)</span>
          </div>
          {language !== "hinglish" && <span className="tray-popup-check">✓</span>}
        </button>

        <button
          className="tray-popup-item"
          onClick={() => handleSelectLanguage("hinglish")}
        >
          <div className="tray-popup-item-left">
            <span className="tray-popup-item-icon">✨</span>
            <span>Hinglish (AI Enhanced)</span>
          </div>
          {language === "hinglish" && <span className="tray-popup-check">✓</span>}
        </button>

        <div className="tray-popup-divider" />

        {/* Actions */}
        <button className="tray-popup-item" onClick={handleOpenSettings}>
          <div className="tray-popup-item-left">
            <span className="tray-popup-item-icon">⚙️</span>
            <span>Open Settings</span>
          </div>
        </button>

        <button className="tray-popup-item danger" onClick={handleQuit}>
          <div className="tray-popup-item-left">
            <span className="tray-popup-item-icon">✕</span>
            <span>Quit Spitit</span>
          </div>
        </button>
      </div>
    </div>
  );
}
