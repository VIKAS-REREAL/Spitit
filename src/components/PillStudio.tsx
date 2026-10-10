import React, { useState } from "react";
import { Pill, PillState } from "./Pill";

export const PillStudio: React.FC = () => {
  const [activeState, setActiveState] = useState<PillState>("recording");
  const [micMessage, setMicMessage] = useState("");

  return (
    <div style={{ background: "#18181b", borderRadius: "12px", border: "1px solid #27272a", padding: "24px", marginTop: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "#FFD505" }}>
            Interactive Pill Studio & States Showcase
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#a1a1aa" }}>
            Visual parity with your design brief: drag anywhere, edge shine, morph transitions, and error popups.
          </p>
        </div>

        {/* State Switcher Tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {(["recording", "silent", "processing", "done", "cancelled", "error"] as PillState[]).map((st) => (
            <button
              key={st}
              onClick={() => setActiveState(st)}
              style={{
                background: activeState === st ? "#FFD505" : "#27272a",
                color: activeState === st ? "#111" : "#e4e4e7",
                border: "none",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                textTransform: "capitalize",
                transition: "all 140ms ease",
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Live Interactive Floating Playground */}
      <div
        style={{
          background: "#09090b",
          border: "1px dashed #3f3f46",
          borderRadius: "10px",
          minHeight: "160px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          padding: "20px",
          marginBottom: "24px",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: "10px", left: "14px", fontSize: "11px", color: "#71717a", textTransform: "uppercase", letterSpacing: "1px" }}>
          Active Interactive Preview (Draggable) — State: <strong style={{ color: "#FFD505" }}>{activeState}</strong>
        </div>

        <Pill
          state={activeState}
          wordCount={14}
          onCancel={() => setActiveState("cancelled")}
          onStop={() => setActiveState("done")}
          onUndo={() => setActiveState("recording")}
          onSelectMic={() => setMicMessage("Microphone settings opened.")}
          onTroubleshoot={() => setMicMessage("Troubleshoot dialog triggered.")}
          onDismissError={() => setActiveState("recording")}
        />

        {micMessage && (
          <div style={{ marginTop: "12px", fontSize: "12px", color: "#3ddc84" }}>
            {micMessage}
          </div>
        )}
      </div>

      {/* Side-by-side reference grid matching user's image exactly */}
      <h3 style={{ margin: "0 0 14px 0", fontSize: "14px", color: "#d4d4d8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Side-by-Side Design Reference Comparison
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          background: "#121214",
          padding: "24px",
          borderRadius: "10px",
          border: "1px solid #27272a",
        }}
      >
        {/* Left Column: Recording, Silent Dots, and Done pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", justifyContent: "center" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "6px" }}>1. Recording (Waveform + Edge Shine)</div>
            <Pill state="recording" />
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "6px" }}>2. Silent / Waiting Voice (Dots)</div>
            <Pill state="silent" />
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "6px" }}>3. Transcription Complete (Tick + Words)</div>
            <Pill state="done" wordCount={12} />
          </div>
        </div>

        {/* Right Column: Pop-up Box & Cancelled Toast from screenshot */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "6px" }}>4. Error Pop-up Box ("We couldn't hear you")</div>
            <Pill
              state="error"
              micName="Built-in mic (recommended)"
              onSelectMic={() => alert("Select microphone clicked")}
              onTroubleshoot={() => alert("Troubleshoot clicked")}
              onDismissError={() => alert("Dismissed")}
            />
          </div>

          <div>
            <div style={{ fontSize: "11px", color: "#71717a", marginBottom: "6px" }}>5. Cancelled Pop-up Pill ("Transcript cancelled [Undo]")</div>
            <Pill
              state="cancelled"
              onUndo={() => alert("Undo transcription cancellation clicked")}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
