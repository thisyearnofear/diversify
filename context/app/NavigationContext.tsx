import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isTabId, LEGACY_TAB_MAP, type TabId } from '@/constants/tabs';
import type { NavigationState, SwapPrefill } from './types';

/**
 * Yield review focus key — identifies a specific opportunity in
 * `BestYieldCard`. Computed from `(chain, symbol)` via the pure
 * `deriveYieldFocusKey()` helper in `hooks/use-best-yield.ts`; both the
 * drawer and the surface call that helper so the shape cannot drift.
 */
export type FocusedYieldKey = string;

/**
 * How long a freshly-focused row stays highlighted before the surface
 * clears the focus and reverts to the unread-notification state. Shared
 * by `PaymentCycleReport` (cycle focus) and `BestYieldCard` (yield focus)
 * so the two surfaces tune UX together. Long enough to read, short enough
 * that a page reload doesn't leave a stale highlight lingering.
 */
export const FOCUS_HIGHLIGHT_MS = 4000;

type NavigationContextValue = NavigationState & {
  setActiveTab: (tab: TabId) => void;
  setChainId: (chainId: number | null) => void;
  setSwapPrefill: (prefill: SwapPrefill | null) => void;
  navigateToSwap: (prefill: SwapPrefill) => void;
  clearSwapPrefill: () => void;
  initializeFromStorage: () => void;
  /**
   * Cycle to focus in `PaymentCycleReport`. Set when the drawer's
   * `open_cycle_review` handler navigates to the Shield tab; consumed
   * (and cleared) by the cycle list once the matching row has been
   * scrolled into view. Stored string is opaque — works equally for
   * MongoDB ObjectIds and the synthetic `${currency}-${currency}-${date}`
   * fallback.
   */
  focusedCycleId: string | null;
  setFocusedCycleId: (id: string | null) => void;
  /**
   * Yield opportunity to highlight in `BestYieldCard`. Same shape as
   * `focusedCycleId` but for the yield review surface.
   */
  focusedYieldKey: FocusedYieldKey | null;
  setFocusedYieldKey: (key: FocusedYieldKey | null) => void;
};

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NavigationState>({
    activeTab: 'protect' satisfies TabId,
    visitedTabs: [],
    chainId: null,
    swapPrefill: null,
  });
  // Transient focus hints set by the drawer's typed action router so the
  // list surfaces can scroll to and highlight the right row. Cleared by
  // the consuming surface once it has focused the row — these are NOT
  // persisted (they reflect the user's current "open this review" gesture,
  // not history).
  const [focusedCycleId, setFocusedCycleId] = useState<string | null>(null);
  const [focusedYieldKey, setFocusedYieldKey] = useState<FocusedYieldKey | null>(null);

  // init from storage (active tab)
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab');
    setState((prev) => ({
      ...prev,
      activeTab: savedTab && isTabId(savedTab) ? savedTab : ('protect' satisfies TabId),
    }));
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', state.activeTab);
  }, [state.activeTab]);

  const setChainId = useCallback((chainId: number | null) => {
    setState((prev) => ({ ...prev, chainId }));
  }, []);

  const setSwapPrefill = useCallback((swapPrefill: SwapPrefill | null) => {
    setState((prev) => ({ ...prev, swapPrefill }));
  }, []);

  const setActiveTab = useCallback((tab: TabId) => {
    setState((prev) => ({
      ...prev,
      activeTab: tab,
      visitedTabs: prev.visitedTabs.includes(tab) ? prev.visitedTabs : [...prev.visitedTabs, tab],
    }));
  }, []);

  const navigateToSwap = useCallback((prefill: SwapPrefill) => {
    setState((prev) => ({ ...prev, activeTab: 'exchange', swapPrefill: prefill }));
  }, []);

  const clearSwapPrefill = useCallback(() => {
    setState((prev) => ({ ...prev, swapPrefill: null }));
  }, []);

  const initializeFromStorage = useCallback(() => {
    const savedTab = localStorage.getItem('activeTab');
    if (!savedTab) return;

    const migrated = LEGACY_TAB_MAP[savedTab];
    const candidate = migrated || savedTab;

    setState((prev) => ({
      ...prev,
      activeTab: isTabId(candidate) ? candidate : 'protect',
    }));
  }, []);

  const value = useMemo<NavigationContextValue>(
    () => ({
      ...state,
      setActiveTab,
      setChainId,
      setSwapPrefill,
      navigateToSwap,
      clearSwapPrefill,
      initializeFromStorage,
      focusedCycleId,
      setFocusedCycleId,
      focusedYieldKey,
      setFocusedYieldKey,
    }),
    [state, setActiveTab, setChainId, setSwapPrefill, navigateToSwap, clearSwapPrefill, initializeFromStorage, focusedCycleId, focusedYieldKey],
  );

  // The consuming surfaces (PaymentCycleReport, BestYieldCard) already
  // auto-clear the focus after 4s once they have highlighted the row.
  // Do not add a parallel context-level clear — a redundant timer would
  // race the surface and could erase the highlight before the surface
  // noticed it. If the hint ever leaks because a surface was unmounted,
  // navigate to the target tab again to reset.

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
