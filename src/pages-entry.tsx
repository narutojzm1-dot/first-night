import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FirstNight } from "@/components/FirstNight";
import "@/styles.css";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <FirstNight />
    </StrictMode>,
  );
}
