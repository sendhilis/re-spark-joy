import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const CACHE_RESET_VERSION = "7";
const CACHE_RESET_KEY = `lipafo-brand-cache-reset-v${CACHE_RESET_VERSION}`;
const BRANDING_STORAGE_PATTERNS = [/rukisha/i, /diaspora-connect/i, /brand-cache-reset/i];

function clearStaleBrandingStorage(storage: Storage) {
  const keysToRemove: string[] = [];

  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && BRANDING_STORAGE_PATTERNS.some((pattern) => pattern.test(key))) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
}

async function resetStaleBrandingCaches() {
  if (
    sessionStorage.getItem(CACHE_RESET_KEY) === "done" &&
    localStorage.getItem(CACHE_RESET_KEY) === "done"
  ) {
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
  clearStaleBrandingStorage(sessionStorage);
  clearStaleBrandingStorage(localStorage);
  sessionStorage.setItem(CACHE_RESET_KEY, "done");
  localStorage.setItem(CACHE_RESET_KEY, "done");

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.get("cacheReset") !== CACHE_RESET_VERSION) {
    currentUrl.searchParams.set("cacheReset", CACHE_RESET_VERSION);
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
