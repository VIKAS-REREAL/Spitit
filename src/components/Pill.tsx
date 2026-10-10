import React, { useState, useEffect, useRef } from "react";
import "./Pill.css";

export type PillState =
  | "recording"
  | "silent"
  | "processing"
  | "done"
  | "cancelled"
  | "error";

interface PillProps {
  state: PillState;
  wordCount?: number;
  appName?: string;
  appIconUrl?: string;
  onCancel?: () => void;
  onStop?: () => void;
  onUndo?: () => void;
  onSelectMic?: () => void;
  onTroubleshoot?: () => void;
  onDismissError?: () => void;
  micName?: string;
}

export const Pill: React.FC<PillProps> = ({
  state,
  wordCount = 12,
  appName = "Active App",
  appIconUrl,
  onCancel,
  onStop,
  onUndo,
  onSelectMic,
  onTroubleshoot,
  onDismissError,
  micName = "Built-in mic (recommended)",
}) => {
  // Waveform animation heights for recording state
  const [waveHeights, setWaveHeights] = useState<number[]>([
    6, 12, 18, 14, 22, 16, 10, 8, 14, 18, 12, 6,
  ]);

  // Position for dragging
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (state !== "recording") return;
    const interval = setInterval(() => {
      setWaveHeights((prev) =>
        prev.map(() => Math.floor(Math.random() * 16) + 4)
      );
    }, 90);
    return () => clearInterval(interval);
  }, [state]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from capsule body, not interactive buttons
    if ((e.target as HTMLElement).closest("button")) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - (position?.x || 0),
      y: e.clientY - (position?.y || 0),
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y,
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  // Style positioning if dragged
  const dragStyle: React.CSSProperties = position
    ? {
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        cursor: "grab",
      }
    : { cursor: "grab" };

  // 1. "Transcript cancelled [Undo]" Pill (Exact match to screenshot bottom right)
  if (state === "cancelled") {
    return (
      <div className="pill-container" style={dragStyle} onMouseDown={handleMouseDown}>
        <div className="pill-cancelled">
          <div className="pill-cancel-icon-circle">!</div>
          <span className="pill-cancel-text">Transcript cancelled</span>
          <button className="pill-undo-btn" onClick={onUndo}>
            Undo
          </button>
        </div>
      </div>
    );
  }

  // 2. "We couldn't hear you" Pop-up Box (Exact match to screenshot top right)
  if (state === "error") {
    return (
      <div className="pill-container" style={dragStyle} onMouseDown={handleMouseDown}>
        <div className="popup-box-container">
          <div className="popup-box-header">
            <div className="popup-box-title-row">
              <div className="popup-box-alert-icon">!</div>
              <div className="popup-box-title">We couldn't hear you</div>
            </div>
            <button
              className="popup-box-close"
              onClick={onDismissError}
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className="popup-box-desc">
            We didn't pick up any speech from your {micName} microphone
          </div>

          <div className="popup-box-actions">
            <button className="popup-box-btn" onClick={onSelectMic}>
              Select microphone
            </button>
            <button className="popup-box-btn" onClick={onTroubleshoot}>
              Troubleshoot
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Regular Pill States: recording, silent, processing, done
  return (
    <div className="pill-container" style={dragStyle} onMouseDown={handleMouseDown}>
      <div className={`pill-capsule ${state}`}>
        {/* Left Circle: App icon or cancel cross */}
        <button
          className="pill-circle-btn"
          onClick={onCancel}
          title={state === "recording" ? "Cancel dictation" : appName}
        >
          {appIconUrl ? (
            <img
              src={appIconUrl}
              alt={appName}
              style={{ width: "16px", height: "16px", borderRadius: "3px" }}
            />
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          )}
        </button>

        {/* Center Content by State */}
        {state === "recording" && (
          <div className="pill-waveform">
            {waveHeights.map((h, i) => (
              <div
                key={i}
                className="pill-wave-bar"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        )}

        {state === "silent" && (
          <div className="pill-dots">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="pill-dot" />
            ))}
          </div>
        )}

        {state === "processing" && (
          <div className="pill-spinner" />
        )}

        {state === "done" && (
          <div className="pill-done-content">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3ddc84"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pill-check-icon"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span className="pill-done-words">{wordCount} words</span>
          </div>
        )}

        {/* Right Stop Recording Square */}
        {(state === "recording" || state === "silent") && (
          <button className="pill-stop-btn" onClick={onStop} title="Stop & transcribe">
            <div className="pill-stop-square" />
          </button>
        )}
      </div>
    </div>
  );
};
