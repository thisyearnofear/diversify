import React, { useCallback, useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EarnService, type EarnVault } from "@diversifi/shared";
import { Card, EmptyState, Skeleton, StatBadge } from "../shared/TabComponents";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  42161: "Arbitrum",
  8453: "Base",
  42220: "Celo",
  11155111: "Sepolia",
};

const RISK_STYLES: Record<EarnVault["risk"], string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

interface YieldDiscoverySectionProps {
  chainId?: number;
  onSelectVault: (vault: EarnVault) => void;
  limit?: number;
  title?: string;
  description?: string;
  className?: string;
  actionLabel?: string;
}

function formatCompactUsd(value?: number): string {
  if (!value || value <= 0) return "New";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function getChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

function getRouteLabel(vault: EarnVault, currentChainId?: number): string {
  if (!currentChainId) return "Route available";
  return currentChainId === vault.chainId ? "Same-chain route" : "Cross-chain route";
}

function getRecommendationReason(vault: EarnVault, currentChainId?: number): string {
  if ((vault.tvl ?? 0) >= 50_000_000) {
    return "Deep liquidity lowers execution and exit friction.";
  }
  if ((vault.apy ?? 0) >= 10) {
    return "High current yield, but confirm rate stability before depositing.";
  }
  if (currentChainId && currentChainId === vault.chainId) {
    return "Same-chain routing keeps the path simpler and easier to review.";
  }
  if (vault.risk === "low") {
    return "Lower-risk positioning fits protection-oriented allocations.";
  }
  return "Balanced risk and liquidity make this a reasonable candidate to review.";
}

function getVaultAccessibilityLabel(vault: EarnVault, currentChainId?: number): string {
  const apyText = typeof vault.apy === "number" ? `${vault.apy.toFixed(2)} percent APY` : "live APY";
  return `Review ${vault.protocol} ${vault.asset.symbol} vault on ${getChainName(vault.chainId)} with ${apyText} and ${getRouteLabel(vault, currentChainId).toLowerCase()}.`;
}

export default function YieldDiscoverySection({
  chainId,
  onSelectVault,
  limit = 3,
  title = "Yield Opportunities",
  description = "Ranked low-to-medium risk vaults across APY, liquidity, and route complexity. Review the route and confirm the amount before depositing.",
  className = "",
  actionLabel = "Review Route",
}: YieldDiscoverySectionProps) {
  const [vaults, setVaults] = useState<EarnVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const statusId = useId();

  const loadVaults = useCallback(async () => {
    setLoading(true);
    try {
      const data = await EarnService.fetchVaults({
        chainIds: chainId ? [chainId] : undefined,
      });

      const sorted = EarnService.rankVaultsForRecommendation(data, {
        maxResults: limit,
        allowedRisk: ["low", "medium"],
        minTvlUsd: 25_000,
      });

      setVaults(sorted);
      setError(null);
    } catch (err) {
      console.error("[YieldDiscovery] Failed to load vaults:", err);
      setVaults([]);
      setError("We could not load live yield opportunities right now.");
    } finally {
      setLoading(false);
    }
  }, [chainId, limit]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  const liveStatusMessage = loading
    ? "Loading ranked yield opportunities."
    : error
      ? error
      : vaults.length > 0
        ? `Loaded ${vaults.length} ranked yield opportunit${vaults.length === 1 ? "y" : "ies"}.`
        : "No ranked yield opportunities are available right now.";

  return (
    <section
      className={className}
      aria-labelledby={headingId}
      aria-describedby={statusId}
    >
      <Card className="border border-sky-100 dark:border-sky-900/40 shadow-[0_18px_40px_-28px_rgba(14,116,144,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h4
                id={headingId}
                className="text-base font-black text-gray-900 dark:text-white"
              >
                {title}
              </h4>
              <span className="inline-flex items-center rounded-full bg-sky-600 px-2.5 py-1 text-xs font-bold text-white">
                LI.FI Earn
              </span>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
              {description}
            </p>
          </div>
          {chainId ? (
            <StatBadge
              label="Source Chain"
              value={getChainName(chainId)}
              color="blue"
            />
          ) : null}
        </div>

        <p id={statusId} className="sr-only" aria-live="polite">
          {liveStatusMessage}
        </p>

        {loading ? (
          <div className="mt-5 grid gap-3" aria-hidden="true">
            {[...Array(limit)].map((_, index) => (
              <div
                key={index}
                className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-900/60"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-12 w-12" variant="circle" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" variant="text" />
                      <Skeleton className="h-3 w-24" variant="text" />
                    </div>
                  </div>
                  <div className="space-y-2 text-right">
                    <Skeleton className="h-6 w-16" variant="text" />
                    <Skeleton className="h-3 w-12 ml-auto" variant="text" />
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Skeleton className="h-14 w-full" variant="rect" />
                  <Skeleton className="h-14 w-full" variant="rect" />
                  <Skeleton className="h-14 w-full" variant="rect" />
                  <Skeleton className="h-14 w-full" variant="rect" />
                </div>
                <Skeleton className="mt-4 h-10 w-full" variant="rect" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20">
            <EmptyState
              icon={<span aria-hidden="true">📉</span>}
              title="Yield data is temporarily unavailable"
              description={error}
              action={{
                label: "Retry",
                onClick: loadVaults,
              }}
            />
          </div>
        ) : vaults.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/70 dark:border-gray-800 dark:bg-gray-900/30">
            <EmptyState
              icon={<span aria-hidden="true">🧭</span>}
              title="No vaults matched the current ranking rules"
              description="Try again on another chain or come back after LI.FI refreshes market availability."
            />
          </div>
        ) : (
          <ul className="mt-5 grid gap-3" role="list">
            <AnimatePresence initial={false}>
              {vaults.map((vault, index) => (
                <motion.li
                  key={vault.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
                  transition={reduceMotion ? { duration: 0 } : { delay: index * 0.05, duration: 0.18 }}
                  className="rounded-2xl border border-gray-100 bg-white/85 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/70"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-100 bg-sky-50 text-lg dark:border-sky-900/60 dark:bg-sky-950/40">
                          {vault.asset.logoURI ? (
                            <img
                              src={vault.asset.logoURI}
                              alt={`${vault.protocol} ${vault.asset.symbol}`}
                              className="h-7 w-7 rounded-full"
                            />
                          ) : (
                            <span aria-hidden="true">📈</span>
                          )}
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h5 className="text-base font-black text-gray-900 dark:text-white">
                              {vault.protocol}
                            </h5>
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                              {vault.asset.symbol}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${RISK_STYLES[vault.risk]}`}>
                              {vault.risk} risk
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                            {vault.name || `${vault.protocol} ${vault.asset.symbol} vault`}
                          </p>
                          <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">
                            {getRecommendationReason(vault, chainId)}
                          </p>
                        </div>
                      </div>

                      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/70">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            APY
                          </dt>
                          <dd className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-300">
                            {typeof vault.apy === "number" ? `${vault.apy.toFixed(2)}%` : "Live"}
                          </dd>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/70">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            TVL
                          </dt>
                          <dd className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                            {formatCompactUsd(vault.tvl)}
                          </dd>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/70">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Chain
                          </dt>
                          <dd className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                            {getChainName(vault.chainId)}
                          </dd>
                        </div>
                        <div className="rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/70">
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Route
                          </dt>
                          <dd className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                            {getRouteLabel(vault, chainId)}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="w-full lg:w-56 lg:shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectVault(vault)}
                        aria-label={getVaultAccessibilityLabel(vault, chainId)}
                        className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 motion-reduce:transition-none"
                      >
                        {actionLabel}
                      </button>
                      <p className="mt-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        You will review the source token, amount, and final LI.FI route before execution.
                      </p>
                    </div>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>
    </section>
  );
}
