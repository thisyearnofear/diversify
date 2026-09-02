import type { MultichainPortfolio, TokenBalance } from "@/hooks/use-multichain-balances";
import type { AllocationSlice } from "@/components/protection-cards/plan-preview";

export interface WalletHolding {
  symbol: string;
  valueUsd: number;
  percent: number;
  balances: TokenBalance[];
}

export interface ProtectionGap {
  token: string;
  heldPercent: number;
  targetPercent: number;
  deltaPercent: number;
}

export type PortfolioFreshness = "empty" | "loading" | "ready" | "stale" | "partial";

export interface WalletPortfolio {
  holdings: WalletHolding[];
  totalUsd: number;
  freshness: PortfolioFreshness;
  hasEstimates: boolean;
}

export interface ProtectionPlan {
  targets: AllocationSlice[];
}

export interface WalletPortfolioView extends WalletPortfolio {
  gaps: ProtectionGap[];
}

export function canSafelyExecute(freshness: PortfolioFreshness): boolean {
  return freshness === "ready";
}

export function getWalletHoldings(portfolio: MultichainPortfolio | null | undefined): WalletHolding[] {
  const balances = (portfolio?.chains ?? []).flatMap((chain) => chain.balances ?? []);
  const byToken = new Map<string, TokenBalance[]>();

  for (const balance of balances) {
    if (balance.value <= 0) continue;
    const existing = byToken.get(balance.symbol) ?? [];
    existing.push(balance);
    byToken.set(balance.symbol, existing);
  }

  const totalUsd = balances.reduce((sum, balance) => sum + Math.max(balance.value, 0), 0);
  if (totalUsd <= 0) return [];

  return [...byToken.entries()]
    .map(([symbol, tokenBalances]) => {
      const valueUsd = tokenBalances.reduce((sum, balance) => sum + balance.value, 0);
      return { symbol, valueUsd, percent: (valueUsd / totalUsd) * 100, balances: tokenBalances };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

export function getProtectionGaps(
  holdings: WalletHolding[],
  targets: AllocationSlice[],
): ProtectionGap[] {
  const heldByToken = new Map(holdings.map((holding) => [holding.symbol, holding.percent]));
  const tokens = new Set([...heldByToken.keys(), ...targets.map((target) => target.token)]);

  return [...tokens]
    .map((token) => {
      const heldPercent = heldByToken.get(token) ?? 0;
      const targetPercent = targets.find((target) => target.token === token)?.percent ?? 0;
      return { token, heldPercent, targetPercent, deltaPercent: targetPercent - heldPercent };
    })
    .sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent));
}

export function buildWalletPortfolioView(
  portfolio: MultichainPortfolio | null | undefined,
  targets: AllocationSlice[] = [],
): WalletPortfolioView {
  const holdings = getWalletHoldings(portfolio);
  const totalUsd = holdings.reduce((sum, holding) => sum + holding.valueUsd, 0);
  const hasErrors = (portfolio?.errors?.length ?? 0) > 0;
  const freshness = portfolio?.isLoading
    ? "loading"
    : totalUsd === 0
      ? "empty"
      : hasErrors
        ? "partial"
        : portfolio?.isStale
          ? "stale"
          : "ready";

  return {
    holdings,
    totalUsd,
    gaps: getProtectionGaps(holdings, targets),
    freshness,
    hasEstimates: Boolean(portfolio?.hasEstimates),
  };
}
