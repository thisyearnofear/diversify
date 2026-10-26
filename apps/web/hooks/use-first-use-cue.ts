/**
 * useFirstUseCue — a one-shot "first use" hint for an affordance that has
 * no visible verb of its own (e.g. the hatched sleeve wedge on Shield's
 * ring). Persists dismissal in localStorage so the cue shows once, ever.
 *
 * SSR-safe: `show` is false until mounted, then reflects storage.
 */
import { useCallback, useEffect, useState } from "react";

const keyFor = (key: string) => `dfi:cue:${key}`;

export function useFirstUseCue(key: string): { show: boolean; markSeen: () => void } {
  const [seen, setSeen] = useState(true);
  useEffect(() => {
    try {
      setSeen(localStorage.getItem(keyFor(key)) === "1");
    } catch {
      setSeen(true);
    }
  }, [key]);
  const markSeen = useCallback(() => {
    setSeen(true);
    try {
      localStorage.setItem(keyFor(key), "1");
    } catch {
      // Ignore storage errors — the cue simply shows again next session.
    }
  }, [key]);
  return { show: !seen, markSeen };
}
