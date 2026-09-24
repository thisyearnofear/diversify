import { useEffect } from "react";
import { trackFunnelEvent } from "@/lib/analytics";

const STORAGE_KEY = "diversifi.lens-offered";
// Fallback when sessionStorage throws (private mode, quota) — still
// once per page life, never twice for the same lens.
const offeredFallback = new Set<string>();

function readOffered(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [...offeredFallback];
  }
}

function writeOffered(list: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    for (const k of list) offeredFallback.add(k);
  }
}

/**
 * Logs `lens_offered` once per session per lens — fired only when the
 * caller's prompt is actually rendered in its slot, so offered→open is
 * an honest denominator for `lens_open`. Never fires for demo surfaces
 * (callers gate `offered` on their own demo flag).
 */
export function useLensOffered(
  tab: "home" | "protect" | "exchange",
  lens: string,
  offered: boolean,
): void {
  useEffect(() => {
    if (!offered) return;
    const key = `${tab}:${lens}`;
    const seen = readOffered();
    if (seen.includes(key)) return;
    writeOffered([...seen, key]);
    offeredFallback.add(key);
    trackFunnelEvent("lens_offered", { tab, lens });
  }, [tab, lens, offered]);
}
