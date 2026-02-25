import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { FinancialStrategy } from './types';

type StrategyContextValue = {
  financialStrategy: FinancialStrategy;
  setFinancialStrategy: (strategy: FinancialStrategy) => void;
};

const StrategyContext = createContext<StrategyContextValue | undefined>(undefined);

export function StrategyProvider({ children }: { children: React.ReactNode }) {
  const [financialStrategy, setFinancialStrategyState] = useState<FinancialStrategy>(null);

  useEffect(() => {
    const saved = localStorage.getItem('financialStrategy') as FinancialStrategy | null;
    setFinancialStrategyState(saved || null);
  }, []);

  const setFinancialStrategy = useCallback((strategy: FinancialStrategy) => {
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
