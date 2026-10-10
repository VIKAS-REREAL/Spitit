import React, { useState, useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { Pill, PillState } from "./components/Pill";

interface ForegroundApp {
  name: string;
  exe_path: string;
  icon_data_url: string | null;
}

export default function PillWindow() {
  const [state, setState] = useState<PillState>("silent");
  const [wordCount, setWordCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("Cancelled");
  const [activeApp, setActiveApp] = useState<ForegroundApp>({
    name: "Spitit",
    exe_path: "",
    icon_data_url: null,
  });

  useEffect(() => {
    // Disable right click context menu completely
    const preventContext = (e: MouseEvent) => e.preventDefault();
    window.addEventListener("contextmenu", preventContext);

    // 1. Listen for recording states from Rust backend
    const unlistenState = listen<string>("recording_state", (event) => {
      const s = event.payload;
      if (s === "recording") {
        setState("recording");
      } else if (s === "processing") {
        setState("processing");
      } else if (s === "no_api_key") {
        setState("error");
        setErrorMessage("No Groq Key (Click)");
        setTimeout(() => {
          invoke("hide_pill_window").catch(() => {});
        }, 3200);
      } else if (s.startsWith("error:")) {
        setState("error");
        const msg = s.replace("error:", "").trim();
        setErrorMessage(msg.length > 22 ? msg.slice(0, 20) + "..." : msg);
        setTimeout(() => {
          invoke("hide_pill_window").catch(() => {});
        }, 3200);
      } else if (s === "cancelled") {
        setState("error");
        setErrorMessage("Cancelled");
        setTimeout(() => {
          invoke("hide_pill_window").catch(() => {});
        }, 1200);
      }
    });

    // 2. Listen for transcript completion
    const unlistenTranscript = listen<string>("transcript_done", (event) => {
      const text = event.payload || "";
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      setWordCount(words);
      setState("done");

      setTimeout(() => {
        invoke("hide_pill_window").catch(() => {});
      }, 1400);
    });

    // 3. Listen for active foreground app changes
    const unlistenApp = listen<ForegroundApp>("foreground_app_changed", (event) => {
      if (event.payload) {
        setActiveApp(event.payload);
      }
    });

    // 4. Handle Esc key cancel
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        invoke("cancel_recording").catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unlistenState.then((f) => f());
      unlistenTranscript.then((f) => f());
      unlistenApp.then((f) => f());
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("contextmenu", preventContext);
    };
  }, []);

  const handleMouseDown = async (e: React.MouseEvent) => {
    if (e.button === 0) {
      try {
        const appWindow = getCurrentWebviewWindow();
        await appWindow.startDragging();
      } catch (err) {
        console.error("Window drag error:", err);
      }
    }
  };

  const handleOpenSettings = () => {
    invoke("open_settings_window").catch(() => {});
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        overflow: "hidden",
        userSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Pill
        state={state}
        wordCount={wordCount}
        errorMessage={errorMessage}
        appName={activeApp.name}
        appIconUrl={activeApp.icon_data_url}
        onMouseDownDrag={handleMouseDown}
        onClickError={handleOpenSettings}
      />
    </div>
  );
}
