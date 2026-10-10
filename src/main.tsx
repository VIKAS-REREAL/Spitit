import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import PillWindow from "./PillWindow";

// Determine if this window instance is the signature Pill window
let isPill = false;
try {
  isPill = getCurrentWebviewWindow().label === "pill";
} catch {
  isPill = false;
}

// Disable default right-click browser context menu globally
window.addEventListener("contextmenu", (e) => e.preventDefault());

if (isPill) {
  // Ensure transparent background for pill window body
  document.documentElement.style.background = "transparent";
  document.body.style.background = "transparent";
  document.body.style.overflow = "hidden";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isPill ? <PillWindow /> : <App />}
  </React.StrictMode>,
);
