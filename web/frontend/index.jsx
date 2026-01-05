import App from "./App";
import { createRoot } from "react-dom/client";
import { initI18n } from "./utils/i18nUtils";

// --- NEW CODE: keep host param in URL ---
const params = new URLSearchParams(window.location.search);
const host = params.get("host");

if (host) {
  // Ensure subsequent navigations always keep the host param
  window.history.replaceState(null, null, `/?host=${host}`);
}
// --- END NEW CODE ---

// Ensure that locales are loaded before rendering the app
initI18n().then(() => {
  const root = createRoot(document.getElementById("app"));
  root.render(<App />);
});
