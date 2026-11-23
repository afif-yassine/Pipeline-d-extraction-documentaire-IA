import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Élément #root introuvable dans index.html");

// StrictMode (développement seulement) lance les effets deux fois pour repérer les effets mal écrits.
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
