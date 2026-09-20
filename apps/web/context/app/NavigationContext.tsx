import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isTabId, LEGACY_TAB_MAP, type TabId } from '@/constants/tabs';
import type { NavigationState, SwapPrefill } from './types';

/**
 * How long a freshly-focused row stays highlighted before the surface
 * clears the focus and reverts to the unread-notification state. Long
 * enough to read, short enough that a page reload doesn't leave a stale
 * highlight lingering.
 */
export const FOCUS_HIGHLIGHT_MS = 4000;

/**
 * One-shot hand-off payload for the Guardian tab: the Shield (or other
 * instrument) slice the user was acting on when they navigated over.
 * The Guardian surface renders it as a context card — so "Guardian
 * activity" doesn't land on a generic page with the user's intent lost —
 * and clears it on consume. `prompt` is a prefilled Ask-Guardian message
 * so the card can hand the conversation the same context in one tap.
 */
export interface GuardianContext {
  /** Short human line, e.g. "JMD — 12% held vs 20% target". */
  summary: string;
  /** Prefilled Ask-Guardian prompt carrying the same context. */
  prompt: string;
  /**
   * The actual journaled record behind an attribution line, carried so the
   * Guardian tab can render it verbatim and ground the answer in what was
   * measured — not a paraphrase.
   */
  decisionRef?: GuardianDecisionRef;
}

export interface GuardianDecisionRef {
  capturedAt: string;
  kind: 'decision' | 'execution' | 'proposal';
  source?: string;
  status?: string;
  reason?: string;
  targetToken?: string;
  txHash?: string;
  durationMs?: number;
}

type NavigationContextValue = NavigationState & {
  setActiveTab: (tab: TabId) => void;
  setChainId: (chainId: number | null) => void;
  setSwapPrefill: (prefill: SwapPrefill | null) => void;
  navigateToSwap: (prefill: SwapPrefill) => void;
  clearSwapPrefill: () => void;
  /** Deep-link to the Exchange tab's counterparty-matching rail — the
   *  pair inspector unfolds with the netting form. Clears any swap
   *  prefill — a netting hand-off is not a swap. */
  navigateToNetting: () => void;
  /** Transient flag — Exchange consumes it once to open the netting
   *  inspector (like `compareRequested` on Shield). */
  nettingRequested: boolean;
  consumeNettingRequest: () => void;
  /** Navigate to the Guardian tab carrying the slice the user was acting
   *  on. `context` is transient — the Guardian surface consumes it once. */
  navigateToGuardian: (context?: GuardianContext) => void;
  /** Current Guardian hand-off (null once consumed or never set). */
  guardianContext: GuardianContext | null;
  clearGuardianContext: () => void;
  /**
   * Deep-link to the Shield tab's compare mode. Sets a transient flag the
   * Shield surface consumes once (like `focusedCycleId`) — not persisted.
   */
  navigateToCompare: () => void;
  compareRequested: boolean;
  consumeCompareRequest: () => void;
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
  // Transient Guardian hand-off — see GuardianContext above. Not persisted:
  // it reflects the current "take this to Guardian" gesture, not history.
  const [guardianContext, setGuardianContext] = useState<GuardianContext | null>(null);
  // Transient Shield-compare hand-off — the Shield tab consumes it once.
  const [compareRequested, setCompareRequested] = useState(false);
  const [nettingRequested, setNettingRequested] = useState(false);

  // init from storage (active tab). A deep-link doorway (?tab=…) wins
  // over the saved tab — read straight from the URL, no router.isReady
  // dependency, and before any descendant's one-shot query consumption.
  useEffect(() => {
    const urlTab =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('tab')
        : null;
    const savedTab = localStorage.getItem('activeTab');
    setState((prev) => ({
      ...prev,
      activeTab:
        urlTab && isTabId(urlTab)
          ? urlTab
          : savedTab && isTabId(savedTab)
            ? savedTab
            : ('protect' satisfies TabId),
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

  /**
   * Open the Exchange tab with the counterparty-matching rail unfolded in
   * the pair inspector. Same intent contract as navigateToSwap: one call,
   * one artefact. Also mirrors the ?netting=1 URL hand-off used by chat
   * deep links.
   */
  const navigateToNetting = useCallback(() => {
    setNettingRequested(true);
    setState((prev) => ({ ...prev, activeTab: 'exchange', swapPrefill: null }));
  }, []);

  const consumeNettingRequest = useCallback(() => {
    setNettingRequested(false);
  }, []);

  /**
   * Open the Guardian tab carrying the slice context the user came from.
   * One call, one artefact — the same contract as navigateToSwap.
   */
  const navigateToGuardian = useCallback((context?: GuardianContext) => {
    setGuardianContext(context ?? null);
    setState((prev) => ({ ...prev, activeTab: 'agent' }));
  }, []);

  const clearGuardianContext = useCallback(() => {
    setGuardianContext(null);
  }, []);

  /**
   * Open the Shield tab in compare mode — the gallery unfolds beneath the
   * ring. One call, one artefact — the same contract as navigateToSwap.
   */
  const navigateToCompare = useCallback(() => {
    setCompareRequested(true);
    setState((prev) => ({ ...prev, activeTab: 'protect', swapPrefill: null }));
  }, []);

  const consumeCompareRequest = useCallback(() => {
    setCompareRequested(false);
  }, []);

  const initializeFromStorage = useCallback(() => {
    const urlTab =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('tab')
        : null;
    const savedTab = localStorage.getItem('activeTab');
    if (!urlTab && !savedTab) return;

    const migrated = savedTab ? LEGACY_TAB_MAP[savedTab] : undefined;
    const candidate = urlTab ?? migrated ?? savedTab;

    setState((prev) => ({
      ...prev,
      activeTab: candidate && isTabId(candidate) ? candidate : 'protect',
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
      navigateToNetting,
      nettingRequested,
      consumeNettingRequest,
      navigateToGuardian,
      guardianContext,
      clearGuardianContext,
      navigateToCompare,
      compareRequested,
      consumeCompareRequest,
      initializeFromStorage,
      focusedCycleId,
      setFocusedCycleId,
    }),
    [state, setActiveTab, setChainId, setSwapPrefill, navigateToSwap, clearSwapPrefill, navigateToNetting, nettingRequested, consumeNettingRequest, navigateToGuardian, guardianContext, clearGuardianContext, navigateToCompare, compareRequested, consumeCompareRequest, initializeFromStorage, focusedCycleId],
  );

  // The consuming surface (PaymentCycleReport) already auto-clears the
  // focus after 4s once it has highlighted the row.
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
