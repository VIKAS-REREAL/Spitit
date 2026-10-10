import React, { useState, useEffect, useRef } from "react";
import "./Pill.css";

export type PillState = "recording" | "silent" | "processing" | "done" | "error";

interface PillProps {
  state: PillState;
  wordCount?: number;
  errorMessage?: string;
  appName?: string;
  appIconUrl?: string | null;
  onMouseDownDrag?: (e: React.MouseEvent) => void;
  onClickError?: () => void;
}

export const Pill: React.FC<PillProps> = ({
  state,
  wordCount = 0,
  errorMessage = "Cancelled",
  appName = "Active App",
  appIconUrl,
  onMouseDownDrag,
  onClickError,
}) => {
  const [durationSec, setDurationSec] = useState(0);
  const audioPlayedRef = useRef<boolean>(false);

  // Live timer during recording
  useEffect(() => {
    if (state !== "recording") {
      setDurationSec(0);
      return;
    }
    setDurationSec(0);
    const startTs = Date.now();
    const timer = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - startTs) / 1000));
    }, 500);
    return () => clearInterval(timer);
  }, [state]);

  // Audio chime when transcription finishes
  useEffect(() => {
    if (state === "done" && !audioPlayedRef.current) {
      audioPlayedRef.current = true;
      try {
        const audio = new Audio("/sound/done.wav");
        audio.volume = 0.65;
        audio.play().catch(() => {});
      } catch {}
    } else if (state !== "done") {
      audioPlayedRef.current = false;
    }
  }, [state]);

  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const renderAppIcon = () => {
    if (appIconUrl) {
      return <img src={appIconUrl} alt={appName} className="pill-app-icon" draggable={false} />;
    }
    const lower = (appName || "").toLowerCase();
    if (lower.includes("whatsapp")) {
      return (
        <span className="pill-app-icon-wrap" title="WhatsApp">
          <svg className="pill-app-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="#25D366">
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19.01L7.55 18.83L4.44 19.65L5.27 16.61L5.07 16.29C4.24 14.97 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67Z" />
          </svg>
        </span>
      );
    }
    if (lower.includes("youtube")) {
      return (
        <span className="pill-app-icon-wrap" title="YouTube">
          <svg className="pill-app-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="#FF0000">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        </span>
      );
    }
    if (lower.includes("github")) {
      return (
        <span className="pill-app-icon-wrap" title="GitHub">
          <svg className="pill-app-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="#FFFFFF">
            <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
          </svg>
        </span>
      );
    }
    if (lower.includes("gmail")) {
      return (
        <span className="pill-app-icon-wrap" title="Gmail">
          <svg className="pill-app-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="#EA4335">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
        </span>
      );
    }
    if (lower.includes("code")) {
      return (
        <span className="pill-app-icon-wrap" title="VS Code">
          <svg className="pill-app-icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="#007ACC">
            <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
          </svg>
        </span>
      );
    }
    return (
      <div className="pill-record-dot" title={appName}>
        <span className="pill-dot-inner" />
      </div>
    );
  };

  return (
    <div
      className="pill-container"
      data-tauri-drag-region
      onMouseDown={onMouseDownDrag}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={`pill-capsule ${state}`}
        data-tauri-drag-region
        onClick={state === "error" ? onClickError : undefined}
      >
        {/* State 1: Active Recording (Superwhisper / Wispr Flow style) */}
        {state === "recording" && (
          <>
            {renderAppIcon()}

            <div className="pill-wave-wrap" data-tauri-drag-region>
              <span className="pill-wave-bar b1" />
              <span className="pill-wave-bar b2" />
              <span className="pill-wave-bar b3" />
              <span className="pill-wave-bar b4" />
              <span className="pill-wave-bar b5" />
            </div>

            <span className="pill-timer" data-tauri-drag-region>
              {formatTimer(durationSec)}
            </span>
          </>
        )}

        {/* State 2: Silent listening */}
        {state === "silent" && (
          <>
            <div className="pill-record-dot amber">
              <span className="pill-dot-inner amber" />
            </div>
            <div className="pill-dots-wrap" data-tauri-drag-region>
              <span className="pill-static-dot" />
              <span className="pill-static-dot" />
              <span className="pill-static-dot" />
            </div>
            <span className="pill-timer">{formatTimer(durationSec)}</span>
          </>
        )}

        {/* State 3: Processing / Transcribing */}
        {state === "processing" && (
          <div className="pill-center-status" data-tauri-drag-region>
            <div className="pill-spinner" />
            <span className="pill-status-label">Transcribing...</span>
          </div>
        )}

        {/* State 4: Transcription Done */}
        {state === "done" && (
          <div className="pill-center-status" data-tauri-drag-region>
            <div className="pill-badge-done">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="pill-words-label">{wordCount} words</span>
          </div>
        )}

        {/* State 5: Error or Cancelled */}
        {state === "error" && (
          <div className="pill-center-status" data-tauri-drag-region>
            <div className="pill-badge-error">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <span className="pill-error-label" title={errorMessage}>
              {errorMessage}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
export default Pill;
