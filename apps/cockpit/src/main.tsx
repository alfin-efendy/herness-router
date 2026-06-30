import React from "react";
import { createRoot } from "react-dom/client";
import { initTheme } from "@harness/ui";
import App from "./App";
import "./index.css";

initTheme();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
