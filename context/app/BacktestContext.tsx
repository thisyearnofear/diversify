/**
 * BacktestContext - Share backtest results across components
 * 
 * Core Principles:
 * - DRY: Centralized backtest state
 * - MODULAR: Used by BacktestPanel, PerformanceChart
 * - RESILIENT: Graceful degradation
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

export interface BacktestResultData {
  scenario: {
    fromToken: string;
    toToken: string;
    amount: string;
  };
  success: boolean;
  expectedOutput?: string;
  priceImpact?: number;
  simulationId?: string;
  error?: string;
}

export interface BacktestState {
  isRunning: boolean;
  results: BacktestResultData[];
  totalSimulations: number;
  successfulSimulations: number;
  totalAlpha: number;
  lastRunAt: number | null;
}

type BacktestContextValue = BacktestState & {
  setBacktestState: (state: Partial<BacktestState>) => void;
  clearResults: () => void;
  addResults: (results: BacktestResultData[], alpha: number) => void;
};

const INITIAL_STATE: BacktestState = {
  isRunning: false,
  results: [],
  totalSimulations: 0,
  successfulSimulations: 0,
  totalAlpha: 0,
  lastRunAt: null,
};

const BacktestContext = createContext<BacktestContextValue | undefined>(undefined);

export function BacktestProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BacktestState>(INITIAL_STATE);

  const setBacktestState = useCallback((partial: Partial<BacktestState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearResults = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const addResults = useCallback((results: BacktestResultData[], alpha: number) => {
    setState((prev) => ({
      ...prev,
      results: [...prev.results, ...results],
      totalSimulations: prev.totalSimulations + results.length,
      successfulSimulations: prev.successfulSimulations + results.filter((r) => r.success).length,
      totalAlpha: prev.totalAlpha + alpha,
      lastRunAt: Date.now(),
    }));
  }, []);

  const value = useMemo<BacktestContextValue>(
    () => ({
      ...state,
      setBacktestState,
      clearResults,
      addResults,
    }),
    [state, setBacktestState, clearResults, addResults]
  );

  return <BacktestContext.Provider value={value}>{children}</BacktestContext.Provider>;
}

export function useBacktestContext(): BacktestContextValue {
  const ctx = useContext(BacktestContext);
  if (!ctx) throw new Error('useBacktestContext must be used within BacktestProvider');
  return ctx;
}
