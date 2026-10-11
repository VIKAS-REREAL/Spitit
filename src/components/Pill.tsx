import React, { useState, useEffect } from "react";
import "./Pill.css";

export type PillState = "recording" | "silent" | "processing" | "done" | "error" | "cancelled";

interface PillProps {
  state: PillState;
  micLevel?: number; // 0.0 to 1.0 from Rust audio capture
  wordCount?: number;
  errorMessage?: string;
  countdownRemaining?: number | null; // e.g. 10..1 seconds in last 10s
  appName?: string;
  appIconUrl?: string | null;
  enableEdgeAnimation?: boolean;
  onMouseDownDrag?: (e: React.MouseEvent) => void;
  onClickError?: () => void;
}

export const Pill: React.FC<PillProps> = ({
  state,
  micLevel = 0,
  wordCount = 0,
  errorMessage = "Cancelled",
  countdownRemaining = null,
  appName = "Active App",
  appIconUrl,
  enableEdgeAnimation = true,
  onMouseDownDrag,
  onClickError,
}) => {
  const [durationSec, setDurationSec] = useState(0);

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

  const formatTimer = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec < 10 ? "0" : ""}${sec}`;
  };

  const renderAppIcon = () => {
    if (appIconUrl) {
      return (
        <img
          src={appIconUrl}
          alt={appName}
          className="pill-app-icon"
          draggable={false}
        />
      );
    }
    // Neutral mic glyph fallback when no icon is available (Section 2.5)
    return (
      <div className="pill-app-icon-wrap" title={appName}>
        <svg
          className="pill-app-icon-svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFD505"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      </div>
    );
  };

  // Waveform bars dynamic scaling based on real voice level
  // Bars stay calm (minimal resting 3px) when silent, and surge up with voice (up to 16px)
  const clampedLevel = Math.max(0, Math.min(1, micLevel));
  const baseResting = 3.2; // minimal resting state
  const maxDynamic = 12.8; // dynamic range

  const b1Height = `${(baseResting + clampedLevel * maxDynamic * 0.65).toFixed(1)}px`;
  const b2Height = `${(baseResting + clampedLevel * maxDynamic * 0.90).toFixed(1)}px`;
  const b3Height = `${(baseResting + clampedLevel * maxDynamic * 1.00).toFixed(1)}px`;
  const b4Height = `${(baseResting + clampedLevel * maxDynamic * 0.85).toFixed(1)}px`;
  const b5Height = `${(baseResting + clampedLevel * maxDynamic * 0.60).toFixed(1)}px`;

  const beamClass = state === "recording" && enableEdgeAnimation ? "has-beam" : "";

  return (
    <div
      className="pill-container"
      onMouseDown={onMouseDownDrag}
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={`pill-capsule ${state} ${beamClass}`}
        onClick={state === "error" ? onClickError : undefined}
      >
        {/* Rotating Light Beam Container (Section 4.1) */}
        {state === "recording" && enableEdgeAnimation && (
          <div
            className="pill-edge-beam-layer"
            style={{ opacity: 0.75 + clampedLevel * 0.25 }}
          />
        )}

        {/* State 1: Active Recording (DISPLAY ONLY: App Icon | Reactive Waves | Live Timer) */}
        {state === "recording" && (
          <>
            {renderAppIcon()}

            <div className="pill-wave-wrap">
              <span
                className="pill-wave-bar"
                style={{ height: b1Height, opacity: clampedLevel > 0.05 ? 1 : 0.45 }}
              />
              <span
                className="pill-wave-bar"
                style={{ height: b2Height, opacity: clampedLevel > 0.05 ? 1 : 0.55 }}
              />
              <span
                className="pill-wave-bar"
                style={{ height: b3Height, opacity: clampedLevel > 0.05 ? 1 : 0.65 }}
              />
              <span
                className="pill-wave-bar"
                style={{ height: b4Height, opacity: clampedLevel > 0.05 ? 1 : 0.55 }}
              />
              <span
                className="pill-wave-bar"
                style={{ height: b5Height, opacity: clampedLevel > 0.05 ? 1 : 0.45 }}
              />
            </div>

            <span className={`pill-timer ${countdownRemaining !== null ? "countdown" : ""}`}>
              {countdownRemaining !== null ? `${countdownRemaining}s` : formatTimer(durationSec)}
            </span>
          </>
        )}

        {/* State 2: Silent listening */}
        {state === "silent" && (
          <>
            <div className="pill-record-dot amber">
              <span className="pill-dot-inner amber" />
            </div>
            <div className="pill-dots-wrap">
              <span className="pill-static-dot" />
              <span className="pill-static-dot" />
              <span className="pill-static-dot" />
            </div>
            <span className="pill-timer">{formatTimer(durationSec)}</span>
          </>
        )}

        {/* State 3: Processing / Transcribing */}
        {state === "processing" && (
          <div className="pill-center-status">
            <div className="pill-spinner" />
            <span className="pill-status-label">Transcribing...</span>
          </div>
        )}

        {/* State 4: Transcription Done (Tick + Word count) */}
        {state === "done" && (
          <div className="pill-center-status">
            <div className="pill-badge-done">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#34C759"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="pill-words-label">{wordCount} words</span>
          </div>
        )}

        {/* State 5: Specific Honest Error */}
        {state === "error" && (
          <div className="pill-center-status">
            <div className="pill-badge-error">
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FF453A"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <span className="pill-error-label" title={errorMessage}>
              {errorMessage}
            </span>
          </div>
        )}

        {/* State 6: Cancelled */}
        {state === "cancelled" && (
          <div className="pill-center-status">
            <span className="pill-cancelled-label">Cancelled</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pill;
