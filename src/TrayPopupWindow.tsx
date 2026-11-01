import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./components/TrayPopup.css";

interface UserSettings {
  language: string;
}

export default function TrayPopupWindow() {
  const [language, setLanguage] = useState<string>("en");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    invoke<UserSettings>("get_all_settings")
      .then((s) => {
        if (s?.language) setLanguage(s.language);
      })
      .catch(() => {});

    // Trigger entry animation after mount
    const t = setTimeout(() => setVisible(true), 10);

    const unlistenLang = listen<string>("language_changed", (event) => {
      setLanguage(event.payload);
    });

    const onBlur = () => {
      invoke("hide_tray_popup").catch(() => {});
    };
    window.addEventListener("blur", onBlur);

    return () => {
      clearTimeout(t);
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
    <div className="tp-root">
      <div className={`tp-card ${visible ? "tp-card--visible" : ""}`}>

        {/* ── Header ── */}
        <div className="tp-header">
          <div className="tp-brand">
            <div className="tp-brand-dot" />
            <span className="tp-brand-name">Spitit</span>
          </div>
          <div className="tp-status-badge">
            <span className="tp-status-dot" />
            Ready
          </div>
        </div>

        {/* ── Language ── */}
        <div className="tp-section-label">Language</div>

        <button
          className={`tp-item ${language !== "hinglish" ? "tp-item--active" : ""}`}
          onClick={() => handleSelectLanguage("en")}
        >
          <span className="tp-item-left">
            <span className="tp-item-ico">
              {/* Globe SVG */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </span>
            <span className="tp-item-label">English</span>
            <span className="tp-item-sub">Fast</span>
          </span>
          {language !== "hinglish" && (
            <span className="tp-check">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          )}
        </button>

        <button
          className={`tp-item ${language === "hinglish" ? "tp-item--active" : ""}`}
          onClick={() => handleSelectLanguage("hinglish")}
        >
          <span className="tp-item-left">
            <span className="tp-item-ico">
              {/* Sparkle / AI SVG */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
              </svg>
            </span>
            <span className="tp-item-label">Hinglish</span>
            <span className="tp-item-sub">AI Enhanced</span>
          </span>
          {language === "hinglish" && (
            <span className="tp-check">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </span>
          )}
        </button>

        {/* ── Separator ── */}
        <div className="tp-sep" />

        {/* ── Actions ── */}
        <button className="tp-item" onClick={handleOpenSettings}>
          <span className="tp-item-left">
            <span className="tp-item-ico">
              {/* Settings gear */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </span>
            <span className="tp-item-label">Settings</span>
          </span>
        </button>

        <button className="tp-item tp-item--danger" onClick={handleQuit}>
          <span className="tp-item-left">
            <span className="tp-item-ico">
              {/* Power / quit */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            <span className="tp-item-label">Quit Spitit</span>
          </span>
        </button>

      </div>
    </div>
  );
}
