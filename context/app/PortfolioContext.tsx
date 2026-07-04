/**
 * PortfolioContext — single shared instance of useMultichainBalances.
 *
 * Before this context, useMultichainBalances was called independently in
 * AgentTierStatus, useAgentChat, SwapTab, useSwapController, and
 * useRiskAssessment — each firing its own set of RPC calls. This provider
 * calls the hook once at the app root and shares the result.
 *
 * Consumers should use `usePortfolio()` instead of `useMultichainBalances()`
 * directly. If a consumer needs a different `userGoal`, it can still call
 * the hook directly — but the common case (same address, same goal) is
 * deduplicated here.
 */

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useMultichainBalances, type MultichainPortfolio } from '../../hooks/use-multichain-balances';
import { useWalletContext } from '../../components/wallet/WalletProvider';
import { useProtectionProfile } from '../../hooks/use-protection-profile';

type PortfolioContextValue = MultichainPortfolio & {
  refresh: () => Promise<void>;
};

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { address } = useWalletContext();
  const { config: profileConfig } = useProtectionProfile();

  const portfolio = useMultichainBalances(address, profileConfig.userGoal || undefined);

  const value = useMemo<PortfolioContextValue>(
    () => ({
      ...portfolio,
      refresh: portfolio.refresh,
    }),
    [portfolio],
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

/**
 * Access the shared portfolio instance. Returns null if used outside a
 * PortfolioProvider — callers should fall back to calling
 * useMultichainBalances directly in that case (e.g. in tests).
 */
export function usePortfolio(): PortfolioContextValue | null {
  return useContext(PortfolioContext);
}

/**
 * Access the shared portfolio instance, falling back to a direct
 * useMultichainBalances call if no provider is present. This is the
 * drop-in replacement for existing `useMultichainBalances(address)` calls.
 */
export function useSharedMultichainBalances(
  address?: string | null,
  userGoal?: string,
): PortfolioContextValue {
  const ctx = usePortfolio();
  // If the context exists, use it — the address and goal are already
  // wired up at the provider level. Only fall back to a direct call if
  // we're outside the provider (tests, storybook, etc.).
  const fallback = useMultichainBalances(address, userGoal);
  return ctx ?? fallback;
}
