import React, { useState, useEffect, useRef } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Pill, PillState } from "./components/Pill";

interface ForegroundApp {
  name: string;
  exe_path: string;
  icon_data_url: string | null;
  hwnd?: number;
}

interface UserSettings {
  pill_edge_animation: boolean;
  play_sound: boolean;
  sound_volume: number;
}

export default function PillWindow() {
  const [state, setState] = useState<PillState>("silent");
  const [micLevel, setMicLevel] = useState<number>(0);
  const [wordCount, setWordCount] = useState<number>(0);
  const [countdownRemaining, setCountdownRemaining] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("Error");
  const [errorType, setErrorType] = useState<string>("");
  const [edgeAnimEnabled, setEdgeAnimEnabled] = useState<boolean>(true);
  const [activeApp, setActiveApp] = useState<ForegroundApp>({
    name: "Spitit",
    exe_path: "",
    icon_data_url: null,
  });

  const soundSettingsRef = useRef<{ play_sound: boolean; volume: number }>({
    play_sound: true,
    volume: 0.7,
  });

  // Load initial settings
  useEffect(() => {
    invoke<UserSettings>("get_all_settings")
      .then((s) => {
        if (s) {
          if (s.pill_edge_animation !== undefined) {
            setEdgeAnimEnabled(s.pill_edge_animation);
          }
          soundSettingsRef.current = {
            play_sound: s.play_sound ?? true,
            volume: (s.sound_volume ?? 70) / 100,
          };
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", preventContext);

    // 1. Live real-time mic level from Rust (30-50 Hz)
    const unlistenLevel = listen<number>("mic_level", (event) => {
      setMicLevel(event.payload || 0);
    });

    // 2. Countdown in last 10 seconds (Section 4.3)
    const unlistenCountdown = listen<number>("countdown_remaining", (event) => {
      setCountdownRemaining(event.payload);
    });

    // 3. Audio Chimes: Start and Done (Section 2.3 - Exactly once per event)
    const unlistenStartSound = listen("play_start_sound", () => {
      if (soundSettingsRef.current.play_sound) {
        try {
          const audio = new Audio("/sound/start.wav");
          audio.volume = soundSettingsRef.current.volume;
          audio.play().catch(() => {});
        } catch {}
      }
    });

    const unlistenDoneSound = listen("play_done_sound", () => {
      if (soundSettingsRef.current.play_sound) {
        try {
          const audio = new Audio("/sound/done.wav");
          audio.volume = soundSettingsRef.current.volume;
          audio.play().catch(() => {});
        } catch {}
      }
    });

    // 4. Live settings changes from main window (Pill edge animation, sound, volume)
    const unlistenSettings = listen<UserSettings>("settings_updated", (event) => {
      const s = event.payload;
      if (s) {
        if (s.pill_edge_animation !== undefined) {
          setEdgeAnimEnabled(s.pill_edge_animation);
        }
        soundSettingsRef.current = {
          play_sound: s.play_sound ?? true,
          volume: (s.sound_volume ?? 70) / 100,
        };
      }
    });

    // 5. Recording states from Rust backend
    const unlistenState = listen<string>("recording_state", (event) => {
      const s = event.payload;
      if (s === "recording") {
        setState("recording");
        setCountdownRemaining(null);
      } else if (s === "processing") {
        setState("processing");
        setCountdownRemaining(null);
      } else if (s === "cancelled") {
        setState("cancelled");
        setCountdownRemaining(null);
        setTimeout(() => {
          invoke("hide_pill_window").catch(() => {});
        }, 900);
      } else if (s.startsWith("error:")) {
        const raw = s.replace("error:", "").trim();
        setState("error");
        setCountdownRemaining(null);

        // Map honest errors according to Section 4.5
        if (raw.includes("ERR_MIC_PRIVACY") || raw.includes("ERR_PERMISSION_DENIED")) {
          setErrorMessage("Mic Blocked (Fix)");
          setErrorType("privacy");
        } else if (raw.includes("ERR_NO_DEVICE")) {
          setErrorMessage("No Mic Found");
          setErrorType("sound_settings");
        } else if (raw.includes("ERR_DEVICE_BUSY")) {
          setErrorMessage("Mic In Use by App");
          setErrorType("sound_settings");
        } else if (raw.includes("ERR_NO_SPEECH")) {
          setErrorMessage("Can't Hear You");
          setErrorType("no_speech");
        } else if (raw.includes("ERR_NO_API_KEY")) {
          setErrorMessage("No Groq Key");
          setErrorType("api_key");
        } else if (raw.includes("ERR_INVALID_KEY")) {
          setErrorMessage("Invalid Key");
          setErrorType("api_key");
        } else if (raw.includes("ERR_RATE_LIMIT")) {
          setErrorMessage("Groq Rate Limit");
          setErrorType("rate_limit");
        } else if (raw.includes("ERR_NETWORK")) {
          setErrorMessage("No Internet");
          setErrorType("network");
        } else if (raw.includes("ERR_ELEVATED")) {
          setErrorMessage("Admin App (Copied)");
          setErrorType("elevated");
        } else {
          setErrorMessage(raw.length > 20 ? raw.slice(0, 18) + "..." : raw);
          setErrorType("general");
        }

        setTimeout(() => {
          invoke("hide_pill_window").catch(() => {});
        }, 3400);
      }
    });

    // 5. Transcript metadata & completion
    const unlistenMeta = listen<{ word_count: number }>("transcript_meta", (event) => {
      const words = event.payload?.word_count || 0;
      setWordCount(words);
      setState("done");
      setCountdownRemaining(null);

      setTimeout(() => {
        invoke("hide_pill_window").catch(() => {});
      }, 1400);
    });

    // 6. Foreground app changed
    const unlistenApp = listen<ForegroundApp>("foreground_app_changed", (event) => {
      if (event.payload) {
        setActiveApp(event.payload);
      }
    });

    // 7. Esc key cancel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        invoke("cancel_recording").catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unlistenLevel.then((f) => f());
      unlistenCountdown.then((f) => f());
      unlistenStartSound.then((f) => f());
      unlistenDoneSound.then((f) => f());
      unlistenSettings.then((f) => f());
      unlistenState.then((f) => f());
      unlistenMeta.then((f) => f());
      unlistenApp.then((f) => f());
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", preventContext);
    };
  }, []);

  // Save pill position after drag
  const handleMouseUp = async () => {
    try {
      const appWindow = getCurrentWebviewWindow();
      const pos = await appWindow.outerPosition();
      await invoke("save_pill_position", { x: pos.x, y: pos.y });
    } catch {}
  };

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  // Section 2.2: Controlled mouse drag — native and Tauri window drag
  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button === 0) {
      try {
        await invoke("start_pill_drag");
        await handleMouseUp();
      } catch {
        try {
          const appWindow = getCurrentWebviewWindow();
          await appWindow.startDragging();
          await handleMouseUp();
        } catch (err) {
          console.error("Window drag error:", err);
        }
      }
    }
  };

  // Section 4.5: Honest error click actions — open exact settings page
  const handleActionForError = () => {
    if (errorType === "privacy") {
      invoke("open_windows_settings", { uri: "ms-settings:privacy-microphone" }).catch(() => {});
    } else if (errorType === "sound_settings") {
      invoke("open_windows_settings", { uri: "ms-settings:sound" }).catch(() => {});
    } else {
      invoke("open_settings_window").catch(() => {});
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        overflow: "hidden",
        userSelect: "none",
        pointerEvents: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Pill
        state={state}
        micLevel={micLevel}
        wordCount={wordCount}
        errorMessage={errorMessage}
        countdownRemaining={countdownRemaining}
        appName={activeApp.name}
        appIconUrl={activeApp.icon_data_url}
        enableEdgeAnimation={edgeAnimEnabled}
        onMouseDownDrag={handleMouseDown}
        onClickError={handleActionForError}
      />
    </div>
  );
}
