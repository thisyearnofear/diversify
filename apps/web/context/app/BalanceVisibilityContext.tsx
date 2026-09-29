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
  useState,
} from "react";
import { formatUsd, MONEY_MASK } from "@/lib/money-format";

const STORAGE_KEY = "diversifi.balances.hidden";

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

  useIsoLayoutEffect(() => {
    setHiddenState(readStored());
  }, []);

  const setHidden = useCallback((next: boolean) => {
    setHiddenState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // storage unavailable (private mode) — the switch still works for
      // the session; persistence is best-effort.
    }
  }, []);

  const toggle = useCallback(() => {
    setHiddenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // best-effort, as above
      }
      return next;
    });
  }, []);

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
