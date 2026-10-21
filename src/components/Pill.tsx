import React, { useState, useEffect, useRef } from "react";
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

  const micLevelRef = useRef(micLevel);
  useEffect(() => {
    micLevelRef.current = micLevel;
  }, [micLevel]);

  const bar0Ref = useRef<HTMLSpanElement>(null);
  const bar1Ref = useRef<HTMLSpanElement>(null);
  const bar2Ref = useRef<HTMLSpanElement>(null);
  const bar3Ref = useRef<HTMLSpanElement>(null);
  const bar4Ref = useRef<HTMLSpanElement>(null);

  // Dynamic 60 FPS voice-reactive wave loop (gentle idle ripple + energetic voice shake)
  useEffect(() => {
    if (state !== "recording") return;

    let animId: number;
    let smoothedLevel = 0;
    const barWeights = [0.65, 0.92, 1.0, 0.88, 0.60];
    const phaseOffsets = [0.0, 1.3, 2.7, 4.1, 5.4];
    const barRefs = [bar0Ref, bar1Ref, bar2Ref, bar3Ref, bar4Ref];

    const animate = (timestamp: number) => {
      const t = timestamp * 0.001;
      const target = Math.max(0, Math.min(1, micLevelRef.current));

      // Snappy attack on voice phonemes, smooth decay on pauses
      const attackSpeed = target > smoothedLevel ? 0.45 : 0.22;
      smoothedLevel += (target - smoothedLevel) * attackSpeed;

      const isSpeaking = smoothedLevel > 0.035;

      barRefs.forEach((ref, i) => {
        const el = ref.current;
        if (!el) return;

        // Idle breathing ripple (3.0px - 4.5px gentle wave so it is never frozen or static)
        const idleWave = Math.sin(t * 3.8 + phaseOffsets[i]) * 0.85 + 3.4;

        // High-frequency voice flutter and harmonic shake
        const flutter = (
          Math.sin(t * 22.0 + phaseOffsets[i] * 2.1) * 0.45 +
          Math.sin(t * 36.0 + phaseOffsets[i] * 3.4) * 0.35 +
          Math.sin(t * 14.0 + phaseOffsets[i]) * 0.20
        );

        // Voice surge height (up to ~16.5px)
        const voiceMax = 13.0 * barWeights[i];
        const voiceHeight = smoothedLevel * voiceMax * (0.75 + 0.35 * flutter);

        const finalHeight = Math.min(17.5, Math.max(2.8, idleWave + voiceHeight));
        el.style.height = `${finalHeight.toFixed(1)}px`;
        el.style.opacity = isSpeaking ? "1" : (0.45 + 0.15 * barWeights[i]).toFixed(2);
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [state]);

  const clampedLevel = Math.max(0, Math.min(1, micLevel));
  const beamClass = state === "recording" && enableEdgeAnimation ? "has-beam" : "";

  return (
    <div
      className="pill-container"
      onDoubleClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className={`pill-capsule ${state} ${beamClass}`}
        data-tauri-drag-region="true"
        onMouseDown={onMouseDownDrag}
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
              <span ref={bar0Ref} className="pill-wave-bar" style={{ height: "3.4px" }} />
              <span ref={bar1Ref} className="pill-wave-bar" style={{ height: "4.2px" }} />
              <span ref={bar2Ref} className="pill-wave-bar" style={{ height: "4.8px" }} />
              <span ref={bar3Ref} className="pill-wave-bar" style={{ height: "4.2px" }} />
              <span ref={bar4Ref} className="pill-wave-bar" style={{ height: "3.4px" }} />
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
