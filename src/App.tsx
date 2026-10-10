import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { PillStudio } from "./components/PillStudio";
import "./App.css";

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState("");
  const [mode, setMode] = useState("hold");
  const [language, setLang] = useState("hinglish");
  const [status, setStatus] = useState("idle");
  const [recentTranscripts, setRecentTranscripts] = useState<string[]>([]);
  const [isManualRecording, setIsManualRecording] = useState(false);

  useEffect(() => {
    // Load stored key from Windows Credential Manager
    invoke<string>("get_api_key")
      .then((k) => {
        if (k) setApiKey(k);
      })
      .catch((e) => console.error("Failed to load key:", e));

    // Listen for events from Rust hotkey loop
    const unlistenState = listen<string>("recording_state", (event) => {
      setStatus(event.payload);
      if (event.payload === "recording") {
        setIsManualRecording(true);
      } else {
        setIsManualRecording(false);
      }
    });

    const unlistenTranscript = listen<string>("transcript_done", (event) => {
      setRecentTranscripts((prev) => [event.payload, ...prev.slice(0, 4)]);
    });

    return () => {
      unlistenState.then((f) => f());
      unlistenTranscript.then((f) => f());
    };
  }, []);

  const handleSaveKey = async () => {
    try {
      await invoke("save_api_key", { apiKey });
      setKeyStatus("Saved securely to Windows Credential Manager!");
    } catch (e: any) {
      setKeyStatus(`Error saving key: ${e}`);
    }
  };

  const handleTestKey = async () => {
    setKeyStatus("Testing API key connection...");
    try {
      const res = await invoke<string>("test_api_key", { apiKey });
      setKeyStatus(res);
    } catch (e: any) {
      setKeyStatus(`Test failed: ${e}`);
    }
  };

  const handleModeChange = async (newMode: string) => {
    setMode(newMode);
    await invoke("set_mode", { modeStr: newMode });
  };

  const handleLangChange = async (newLang: string) => {
    setLang(newLang);
    await invoke("set_language", { lang: newLang });
  };

  const toggleManualRecording = async () => {
    if (!isManualRecording) {
      try {
        await invoke("start_manual_record");
        setIsManualRecording(true);
        setStatus("recording");
      } catch (e) {
        alert("Failed to start recording: " + e);
      }
    } else {
      setStatus("processing");
      try {
        const text = await invoke<string>("stop_manual_record");
        setIsManualRecording(false);
        setStatus("idle");
        if (text) {
          setRecentTranscripts((prev) => [text, ...prev.slice(0, 4)]);
        }
      } catch (e) {
        alert("Transcription failed: " + e);
        setStatus("idle");
        setIsManualRecording(false);
      }
    }
  };

  return (
    <div style={{ padding: "24px", fontFamily: "Segoe UI, sans-serif", color: "#f0f0f0", background: "#111113", minHeight: "100vh" }}>
      <header style={{ borderBottom: "1px solid #2a2a2e", paddingBottom: "16px", marginBottom: "20px" }}>
        <h1 style={{ margin: "0 0 6px 0", fontSize: "22px", color: "#FFD505" }}>REREAL Spitit v3 â€” Core Spike Test Harness</h1>
        <p style={{ margin: 0, fontSize: "13px", color: "#8e8e93" }}>
          Step 1 verification: WH_KEYBOARD_LL hook Â· 16 kHz in-memory WAV Â· Groq Whisper + Hinglish LLM Â· SendInput auto-paste Â· Single Instance
        </p>
      </header>

      {/* Status Banner */}
      <section style={{ background: "#1a1a1e", border: "1px solid #333", borderRadius: "8px", padding: "16px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: "12px", color: "#8e8e93", textTransform: "uppercase", letterSpacing: "1px" }}>Current State</div>
            <div style={{ fontSize: "20px", fontWeight: "bold", color: status === "recording" ? "#FFD505" : status === "processing" ? "#4d9eff" : "#3ddc84" }}>
              {status === "recording" ? "ðŸŽ™ï¸ RECORDING..." : status === "processing" ? "â³ PROCESSING..." : "READY"}
            </div>
          </div>
          <div>
            <button
              onClick={toggleManualRecording}
              style={{
                background: isManualRecording ? "#ff5f5f" : "#FFD505",
                color: isManualRecording ? "#fff" : "#111",
                border: "none",
                borderRadius: "6px",
                padding: "10px 18px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {isManualRecording ? "Stop & Paste" : "Manual Record Test"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: "12px", color: "#aaa", marginTop: "10px", marginBottom: 0 }}>
          {mode === "hold" ? "Hold Alt + Left Shift to speak. Release to auto-paste." : "Press Alt + Left Shift once to start, press again to stop & paste."}
        </p>
      </section>

      {/* Configuration Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
        {/* Hotkey & Mode Card */}
        <div style={{ background: "#1a1a1e", border: "1px solid #2a2a2e", borderRadius: "8px", padding: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Activation Mode</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input type="radio" name="mode" value="hold" checked={mode === "hold"} onChange={() => handleModeChange("hold")} />
              Hold (Alt + LShift)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input type="radio" name="mode" value="toggle" checked={mode === "toggle"} onChange={() => handleModeChange("toggle")} />
              Toggle (Alt + LShift)
            </label>
          </div>

          <h3 style={{ margin: "16px 0 10px 0", fontSize: "15px" }}>Language</h3>
          <select
            value={language}
            onChange={(e) => handleLangChange(e.target.value)}
            style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "#222", color: "#fff", border: "1px solid #444" }}
          >
            <option value="hinglish">Hinglish (Roman transliteration)</option>
            <option value="en">English</option>
            <option value="hi">Hindi (Devanagari)</option>
            <option value="mixed_hi_en">Hindi + English Mix</option>
            <option value="auto">Auto-detect</option>
          </select>
        </div>

        {/* Windows Credential Manager Card */}
        <div style={{ background: "#1a1a1e", border: "1px solid #2a2a2e", borderRadius: "8px", padding: "16px" }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Groq API Key</h3>
          <input
            type="password"
            placeholder="gsk_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: "95%", padding: "8px", borderRadius: "6px", background: "#222", color: "#fff", border: "1px solid #444", marginBottom: "10px" }}
          />
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleSaveKey}
              style={{ background: "#333", color: "#fff", border: "1px solid #555", borderRadius: "6px", padding: "6px 12px", cursor: "pointer" }}
            >
              Save Key
            </button>
            <button
              onClick={handleTestKey}
              style={{ background: "#333", color: "#fff", border: "1px solid #555", borderRadius: "6px", padding: "6px 12px", cursor: "pointer" }}
            >
              Test Key
            </button>
          </div>
          {keyStatus && <div style={{ fontSize: "12px", marginTop: "8px", color: keyStatus.includes("Error") || keyStatus.includes("failed") ? "#ff5f5f" : "#3ddc84" }}>{keyStatus}</div>}
        </div>
      </div>

      {/* Interactive Pill Studio & State Visualizer */}
      <PillStudio />

      {/* Transcripts Log */}
      <section style={{ background: "#1a1a1e", border: "1px solid #2a2a2e", borderRadius: "8px", padding: "16px", marginTop: "24px" }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "15px" }}>Recent Transcriptions (Auto-Pasted)</h3>
        {recentTranscripts.length === 0 ? (
          <p style={{ color: "#666", fontSize: "13px", margin: 0 }}>No transcriptions yet. Try holding Alt + LShift and speaking.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: "18px" }}>
            {recentTranscripts.map((t, idx) => (
              <li key={idx} style={{ marginBottom: "8px", fontSize: "14px", color: "#e0e0e0" }}>
                "{t}"
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

