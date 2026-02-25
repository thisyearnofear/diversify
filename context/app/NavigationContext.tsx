import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isTabId, LEGACY_TAB_MAP, type TabId } from '@/constants/tabs';
import type { NavigationState, SwapPrefill } from './types';

type NavigationContextValue = NavigationState & {
  setActiveTab: (tab: TabId) => void;
  setChainId: (chainId: number | null) => void;
  setSwapPrefill: (prefill: SwapPrefill | null) => void;
  navigateToSwap: (prefill: SwapPrefill) => void;
  clearSwapPrefill: () => void;
  initializeFromStorage: () => void;
};

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<NavigationState>({
    activeTab: 'overview' satisfies TabId,
    visitedTabs: [],
    chainId: null,
    swapPrefill: null,
  });

  // init from storage (active tab)
  useEffect(() => {
    const savedTab = localStorage.getItem('activeTab');
    setState((prev) => ({
      ...prev,
      activeTab: savedTab && isTabId(savedTab) ? savedTab : ('overview' satisfies TabId),
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
    setState((prev) => ({ ...prev, activeTab: 'swap', swapPrefill: prefill }));
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
      activeTab: isTabId(candidate) ? candidate : 'overview',
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
    }),
    [state, setActiveTab, setChainId, setSwapPrefill, navigateToSwap, clearSwapPrefill, initializeFromStorage],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}
