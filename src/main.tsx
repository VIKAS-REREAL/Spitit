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

// Fallback checking URL hash or href for maximum reliability
if (!windowLabel || windowLabel === "main") {
  if (window.location.hash.includes("splash") || window.location.href.includes("splash")) {
    windowLabel = "splash";
  } else if (window.location.hash.includes("pill") || window.location.href.includes("pill")) {
    windowLabel = "pill";
  } else if (window.location.hash.includes("tray") || window.location.href.includes("tray")) {
    windowLabel = "tray_popup";
  }
}

const isPill = windowLabel === "pill";
const isTrayPopup = windowLabel === "tray_popup";
const isSplash = windowLabel === "splash";

// Disable default right-click browser context menu globally
window.addEventListener("contextmenu", (e) => e.preventDefault());

if (isPill || isTrayPopup) {
  // Stamp a data attribute on <html> BEFORE any CSS loads.
  // App.css uses this to skip the dark background on overlay windows.
  document.documentElement.setAttribute("data-overlay", "true");
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.body.style.margin = "0";
  document.body.style.padding = "0";
  document.body.style.overflow = "hidden";
}

if (isSplash) {
  // Solid obsidian background for splash screen (matching Discord-style frameless popup)
  document.documentElement.style.background = "#0f0f13";
  document.body.style.background = "#0f0f13";
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
