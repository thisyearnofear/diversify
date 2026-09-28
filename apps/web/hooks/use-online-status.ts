/**
 * useOnlineStatus — the browser's view of connectivity, as a subscription.
 *
 * `navigator.onLine === false` is reliable (no network interface);
 * `true` only means "probably". Treat offline as a hard signal and online
 * as "try it". SSR and the first client render assume online so markup
 * matches.
 */
import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => !isBrowserOffline(),
    () => true,
  );
}
