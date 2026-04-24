import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const CACHE_RESET_KEY = "lipafo-brand-cache-reset-v3";

async function resetStaleBrandingCaches() {
  if (sessionStorage.getItem(CACHE_RESET_KEY) === "done") {
    return false;
  }

  const resetTasks: Promise<unknown>[] = [];

  if ("serviceWorker" in navigator) {
    resetTasks.push(
      navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      ),
    );
  }

  if ("caches" in window) {
    resetTasks.push(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    );
  }

  await Promise.all(resetTasks);
  sessionStorage.setItem(CACHE_RESET_KEY, "done");

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.get("cacheReset") !== "1") {
    currentUrl.searchParams.set("cacheReset", "1");
    window.location.replace(currentUrl.toString());
    return true;
  }

  return false;
}

resetStaleBrandingCaches().then((reloading) => {
  if (reloading) {
    return;
  }

  createRoot(document.getElementById("root")!).render(<App />);
});
