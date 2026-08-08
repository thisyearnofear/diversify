import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { DemoModeState } from './types';
import { useNavigation } from './NavigationContext';

type DemoModeContextValue = {
  demoMode: DemoModeState;
  enableDemoMode: () => void;
  disableDemoMode: () => void;
};

const DemoModeContext = createContext<DemoModeContextValue | undefined>(undefined);

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
    setDemoMode((prev) => ({ ...prev, isActive: false }));
  }, []);

  const value = useMemo<DemoModeContextValue>(
    () => ({ demoMode, enableDemoMode, disableDemoMode }),
    [demoMode, enableDemoMode, disableDemoMode],
  );

  return <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>;
}

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) throw new Error('useDemoMode must be used within DemoModeProvider');
  return ctx;
}
