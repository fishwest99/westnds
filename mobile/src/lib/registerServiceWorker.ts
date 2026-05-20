import { Platform } from "react-native";

/**
 * Registers the PWA service worker on web only.
 * No-ops on iOS/Android so native builds are completely unaffected.
 */
export function registerServiceWorker() {
  if (Platform.OS !== "web") return;
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("[PWA] Service worker registration failed:", err));
  });
}
