import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { FinancialStrategy, NullableFinancialStrategy } from './types';

type StrategyContextValue = {
  financialStrategy: NullableFinancialStrategy;
  setFinancialStrategy: (strategy: NullableFinancialStrategy) => void;
};

const StrategyContext = createContext<StrategyContextValue | undefined>(undefined);

export function StrategyProvider({ children }: { children: React.ReactNode }) {
  const [financialStrategy, setFinancialStrategyState] = useState<NullableFinancialStrategy>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('financialStrategy') as FinancialStrategy | null;
      return saved || null;
    }
    return null;
  });

  const setFinancialStrategy = useCallback((strategy: NullableFinancialStrategy) => {
    setFinancialStrategyState(strategy);
    if (typeof window !== 'undefined') {
      if (strategy) localStorage.setItem('financialStrategy', strategy);
      else localStorage.removeItem('financialStrategy');
    }
  }, []);

  const value = useMemo<StrategyContextValue>(
    () => ({ financialStrategy, setFinancialStrategy }),
    [financialStrategy, setFinancialStrategy],
  );

  return <StrategyContext.Provider value={value}>{children}</StrategyContext.Provider>;
}

export function useStrategy(): StrategyContextValue {
  const ctx = useContext(StrategyContext);
  if (!ctx) throw new Error('useStrategy must be used within StrategyProvider');
  return ctx;
}
