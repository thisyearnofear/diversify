import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { DemoModeState, NullableFinancialStrategy } from './types';
import { useNavigation } from './NavigationContext';

type DemoModeContextValue = {
  demoMode: DemoModeState;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
  setDemoStrategy: (strategy: NullableFinancialStrategy) => void;
};

/** Exported for soft reads — listeners that must not throw when a test
 *  renders their host outside the provider (e.g. share-landing). */
export const DemoModeContext = createContext<DemoModeContextValue | undefined>(undefined);

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const { setActiveTab } = useNavigation();
  const [demoMode, setDemoMode] = useState<DemoModeState>({
    isActive: false,
    mockAddress: '0xDemo1234567890123456789012345678901234',
    mockChainId: 42220,
  });

  const enableDemoMode = useCallback(() => {
    setDemoMode((prev) => ({ ...prev, isActive: true }));
    setActiveTab('overview');
  }, [setActiveTab]);

  const disableDemoMode = useCallback(() => {
    setDemoMode((prev) => ({ ...prev, isActive: false, previewStrategy: undefined }));
  }, []);

  const setDemoStrategy = useCallback((previewStrategy: NullableFinancialStrategy) => {
    setDemoMode((prev) => ({ ...prev, previewStrategy }));
  }, []);

  const value = useMemo<DemoModeContextValue>(
    () => ({ demoMode, enableDemoMode, disableDemoMode, setDemoStrategy }),
    [demoMode, enableDemoMode, disableDemoMode, setDemoStrategy],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error('useDemoMode must be used within DemoModeProvider');
  return ctx;
}
