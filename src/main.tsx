import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import PillWindow from "./PillWindow";
import TrayPopupWindow from "./TrayPopupWindow";
import SplashWindow from "./SplashWindow";

// Determine which window instance this webview is rendering
let windowLabel = "main";
try {
  windowLabel = getCurrentWebviewWindow().label;
} catch {
  windowLabel = "main";
}

const isPill = windowLabel === "pill";
const isTrayPopup = windowLabel === "tray_popup";
const isSplash = windowLabel === "splash";

// Disable default right-click browser context menu globally
window.addEventListener("contextmenu", (e) => e.preventDefault());

if (isPill || isTrayPopup || isSplash) {
  // Ensure transparent background for floating overlay windows
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.body.style.overflow = "hidden";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isPill ? (
      <PillWindow />
    ) : isTrayPopup ? (
      <TrayPopupWindow />
    ) : isSplash ? (
      <SplashWindow />
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
