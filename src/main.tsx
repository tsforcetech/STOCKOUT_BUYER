import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/styles/globals.css";
import { App } from "@/app/app";
import { reloadOnce } from "@/lib/utils/reload";

// Vite fires this when a lazily loaded page file can't be fetched (stale page after a deploy, dropped connection).
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnce()) event.preventDefault();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
