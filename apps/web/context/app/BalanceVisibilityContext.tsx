/**
 * BalanceVisibilityContext — the one privacy switch for dollar amounts.
 *
 * An FX-risk app gets opened in public places. When hidden, every money
 * figure that flows through `formatMoney` renders as dots (never a fake
 * zero, never a blur — blur is TrustFootnote's stillness affordance, not a
 * hide). Percentages, plans, and decisions stay visible: privacy covers
 * how much you have, not what the product thinks.
 *
 * Persisted per device under `diversifi.balances.hidden`, default visible.
 * Hydration follows the ExperienceContext pattern (read after mount) so
 * server render never guesses the user's stored choice.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatUsd, MONEY_MASK } from "@/lib/money-format";

const STORAGE_KEY = "diversifi.balances.hidden";
// Re-hide memory: everHidden marks "this person hides balances"; the
// lastActiveAt stamp measures how long the app was away. Only people
// who have hidden before get the auto re-hide — never a new setting.
const EVER_HIDDEN_KEY = "diversifi.balances.everHidden";
const LAST_ACTIVE_KEY = "diversifi.balances.lastActiveAt";
const REHIDE_AFTER_MS = 60_000;

type BalanceVisibilityValue = {
  /** True while dollar amounts are masked. */
  hidden: boolean;
  /** Flip the switch (and persist it). */
  toggle: () => void;
  /** Explicit set (used by e.g. auto re-hide policies later). */
  setHidden: (hidden: boolean) => void;
  /** formatUsd, or MONEY_MASK while hidden. The one money formatter for
   *  privacy-aware surfaces — pass every dollar figure through it. */
  formatMoney: (value: number) => string;
};

// Default (no provider) = visible, so isolated trees/tests behave as today.
const BalanceVisibilityContext = createContext<BalanceVisibilityValue>({
  hidden: false,
  toggle: () => {},
  setHidden: () => {},
  formatMoney: formatUsd,
});

function readStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// useLayoutEffect on the client so a stored "hidden" applies before paint
// (no unmasked flash); useEffect on the server where layout effects warn.
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function BalanceVisibilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hidden, setHiddenState] = useState(false);
  const hiddenRef = useRef(false);

  // Re-hide on return: only if this device has chosen hidden before AND
  // was away ≥60s. Runs inside the layout-effect hydration so a stale
  // visible balance never paints on a fresh mount.
  const dueRehide = useCallback((): boolean => {
    try {
      if (localStorage.getItem(EVER_HIDDEN_KEY) !== "1") return false;
      const last = Number(localStorage.getItem(LAST_ACTIVE_KEY));
      return Number.isFinite(last) && Date.now() - last >= REHIDE_AFTER_MS;
    } catch {
      return false;
    }
  }, []);

  useIsoLayoutEffect(() => {
    if (!readStored() && dueRehide()) {
      setHiddenState(true);
      hiddenRef.current = true;
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // best-effort, as everywhere else
      }
      return;
    }
    const stored = readStored();
    setHiddenState(stored);
    hiddenRef.current = stored;
  }, [dueRehide]);

  const setHidden = useCallback((next: boolean) => {
    setHiddenState(next);
    hiddenRef.current = next;
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      if (next) localStorage.setItem(EVER_HIDDEN_KEY, "1");
    } catch {
      // storage unavailable (private mode) — the switch still works for
      // the session; persistence is best-effort.
    }
  }, []);

  const toggle = useCallback(() => {
    setHiddenState((prev) => {
      const next = !prev;
      hiddenRef.current = next;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
        if (next) localStorage.setItem(EVER_HIDDEN_KEY, "1");
      } catch {
        // best-effort, as above
      }
      return next;
    });
  }, []);

  // Stamp last-active when the page hides/unloads; re-hide on return
  // after ≥60s away (only for people who have hidden before).
  useEffect(() => {
    const markAway = () => {
      try {
        localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
      } catch {
        // best-effort
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        markAway();
        return;
      }
      if (document.visibilityState === "visible" && !hiddenRef.current && dueRehide()) {
        setHidden(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", markAway);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", markAway);
    };
  }, [dueRehide, setHidden]);

  const formatMoney = useCallback(
    (value: number) => (hidden ? MONEY_MASK : formatUsd(value)),
    [hidden],
  );

  const value = useMemo(
    () => ({ hidden, toggle, setHidden, formatMoney }),
    [hidden, toggle, setHidden, formatMoney],
  );

  return (
    <BalanceVisibilityContext.Provider value={value}>
      {children}
    </BalanceVisibilityContext.Provider>
  );
}

export function useBalanceVisibility(): BalanceVisibilityValue {
  return useContext(BalanceVisibilityContext);
}
