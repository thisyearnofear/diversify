import type { MultichainPortfolio, TokenBalance } from "@/hooks/use-multichain-balances";
import type { PlanLeg, PlanRules } from "@/components/protection-cards/plan-preview";
import { canonicalToken, displayToken } from "@/lib/plan-legs";
import { planLegIndexFor } from "@/lib/plan-alignment";

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
  targets: PlanLeg[];
}

export interface WalletPortfolioView extends WalletPortfolio {
  gaps: ProtectionGap[];
}

export function canSafelyExecute(freshness: PortfolioFreshness): boolean {
  return freshness === "ready";
}

export function getWalletHoldings(portfolio: MultichainPortfolio | null | undefined): WalletHolding[] {
  const balances = (portfolio?.chains ?? []).flatMap((chain) =>
    (chain.balances ?? []).map((balance) => ({
      ...balance,
      chainId: balance.chainId ?? chain.chainId,
      chainName: balance.chainName ?? chain.chainName,
    })),
  );
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
  targets: PlanLeg[],
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

/**
 * Same exposure, many tokens: a wallet can report USDm on Celo and USDC on
 * Arbitrum while the plan's Dollar leg is cUSD. When a plan is in scope,
 * re-bucket holdings under the plan leg they count toward (else their
 * canonical name) so the legend shows one Dollar row, not stray
 * "not in plan" rows. `balances` keeps what it is held as.
 */
function canonicaliseHoldings(
  holdings: WalletHolding[],
  targets: PlanLeg[],
  rules: PlanRules,
): WalletHolding[] {
  const byToken = new Map<string, WalletHolding>();
  for (const holding of holdings) {
    const legIndex = planLegIndexFor(holding.symbol, targets, rules);
    const key = legIndex >= 0 ? targets[legIndex].token : canonicalToken(holding.symbol);
    const existing = byToken.get(key);
    if (existing) {
      existing.valueUsd += holding.valueUsd;
      existing.percent += holding.percent;
      existing.balances.push(...holding.balances);
    } else {
      byToken.set(key, { ...holding, symbol: key, balances: [...holding.balances] });
    }
  }
  return [...byToken.values()].sort((a, b) => b.valueUsd - a.valueUsd);
}

export function buildWalletPortfolioView(
  portfolio: MultichainPortfolio | null | undefined,
  targets: PlanLeg[] = [],
  rules: PlanRules = {},
): WalletPortfolioView {
  const rawHoldings = getWalletHoldings(portfolio);
  const holdings = targets.length > 0 ? canonicaliseHoldings(rawHoldings, targets, rules) : rawHoldings;
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

function heldAsParts(holding: WalletHolding | undefined): [string, string, number][] {
  const parts = new Map<string, [string, string, number]>();
  for (const b of holding?.balances ?? []) {
    if (!(b.value > 0)) continue;
    const symbol = displayToken(b.symbol);
    const key = `${symbol}|${b.chainName ?? ''}`;
    const prev = parts.get(key);
    parts.set(key, [symbol, b.chainName ?? '', (prev?.[2] ?? 0) + b.value]);
  }
  return [...parts.values()].sort((a, b) => b[2] - a[2]);
}

/** "Held as: USDC · Arbitrum 40%, USDm · Celo 10%" — shares of the whole wallet. */
export function heldAsLine(holding: WalletHolding | undefined, totalUsd: number): string | null {
  const parts = heldAsParts(holding);
  if (parts.length === 0 || totalUsd <= 0) return null;
  return `Held as: ${parts
    .map(([symbol, chain, value]) => `${symbol}${chain ? ' · ' + chain : ''} ${Math.round((value / totalUsd) * 100)}%`)
    .join(', ')}`;
}

/** The token a slice is mostly held as, for the coin face. */
export function heldAsSymbol(holding: WalletHolding | undefined): string | null {
  return heldAsParts(holding)[0]?.[0] ?? null;
}
