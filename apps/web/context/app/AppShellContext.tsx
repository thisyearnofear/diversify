/**
 * AppShellContext — single shared instance of useAppShell.
 *
 * useAppShell() aggregates portfolio balances, region detection, inflation
 * data, and advisor/streak hooks — all real fetch/RPC work. AppShell and
 * TabContentRouter both used to call it independently, mounting two full
 * copies of that work (on top of PortfolioProvider's own instance). This
 * context makes AppShell the single caller; TabContentRouter (and anything
 * else in the tree) reads the shared result instead.
 */

import React, { createContext, useContext, type ReactNode } from 'react';
import { useAppShell } from '../../hooks/use-app-shell';

type AppShellValue = ReturnType<typeof useAppShell>;

const AppShellContext = createContext<AppShellValue | null>(null);

export function AppShellProvider({ children }: { children: ReactNode }) {
  const value = useAppShell();
  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShellContext(): AppShellValue {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error('useAppShellContext must be used within AppShellProvider');
  }
  return ctx;
}
