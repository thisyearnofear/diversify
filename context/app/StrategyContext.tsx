import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { FinancialStrategy, NullableFinancialStrategy } from './types';
import { loadPhilosophy, savePhilosophy } from '@/hooks/use-protection-profile';

type StrategyContextValue = {
  financialStrategy: NullableFinancialStrategy;
  setFinancialStrategy: (strategy: NullableFinancialStrategy) => void;
};

const StrategyContext = createContext<StrategyContextValue | undefined>(undefined);

const PROFILE_STORAGE_KEY = 'diversifi-protection-profile-v2';

/**
 * Thin React context over `philosophy` in the protection profile.
 * Persists via `savePhilosophy()` — no separate `financialStrategy` key.
 */
export function StrategyProvider({ children }: { children: React.ReactNode }) {
  const [financialStrategy, setFinancialStrategyState] = useState<NullableFinancialStrategy>(() =>
    typeof window !== 'undefined' ? loadPhilosophy() : null,
  );

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === PROFILE_STORAGE_KEY || e.key === 'financialStrategy') {
        setFinancialStrategyState(loadPhilosophy());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setFinancialStrategy = useCallback((strategy: NullableFinancialStrategy) => {
    setFinancialStrategyState(strategy);
    savePhilosophy(strategy as FinancialStrategy | null);
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
