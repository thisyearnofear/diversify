import React, { useCallback, useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EarnService, type EarnVault } from "@diversifi/shared";
import { Card, StatBadge } from "../shared/TabComponents";
import { NETWORKS } from "../../config";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  10: "Optimism",
  42161: "Arbitrum",
  8453: "Base",
  [NETWORKS.CELO_MAINNET.chainId]: "Celo",
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
  const [available, setAvailable] = useState(true);
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

      if (sorted.length === 0) {
        // No live data available — hide the section entirely
        setAvailable(false);
      } else {
        setVaults(sorted);
        setAvailable(true);
      }
    } catch {
      // API unavailable (no key, network error, etc.) — hide silently
      setAvailable(false);
    } finally {
      setLoading(false);
    }
  }, [chainId, limit]);

  useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  // Don't render anything while loading or if data isn't available
  if (loading || !available) return null;

  return (
    <section
      className={className}
      aria-labelledby={headingId}
      aria-describedby={statusId}
    >
      <Card className="border border-sky-100 dark:border-sky-900/40 shadow-[0_18px_40px_-28px_rgba(14,116,144,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4
                id={headingId}
                className="text-sm font-bold text-gray-900 dark:text-white"
              >
                {title}
              </h4>
              <span className="inline-flex items-center rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white">
                LI.FI Earn
              </span>
            </div>
            <p className="max-w-xl text-xs text-gray-500 dark:text-gray-400">
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
          {`Showing ${vaults.length} ranked yield opportunit${vaults.length === 1 ? "y" : "ies"}.`}
        </p>

        <ul className="mt-3 space-y-1.5" role="list">
          <AnimatePresence initial={false}>
            {vaults.map((vault, index) => (
              <motion.li
                key={vault.id}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                transition={reduceMotion ? { duration: 0 } : { delay: index * 0.03, duration: 0.15 }}
                className="rounded-xl border border-gray-100 bg-white/85 px-3 py-2.5 shadow-sm dark:border-gray-800 dark:bg-gray-900/70"
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-100 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/40">
                    {vault.asset.logoURI ? (
                      <img
                        src={vault.asset.logoURI}
                        alt=""
                        className="h-5 w-5 rounded-full"
                      />
                    ) : (
                      <span aria-hidden="true" className="text-sm">📈</span>
                    )}
                  </div>

                  {/* Protocol + Asset */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {vault.protocol}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {vault.asset.symbol}
                      </span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize leading-none ${RISK_STYLES[vault.risk]}`}>
                        {vault.risk}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {getChainName(vault.chainId)} · {getRouteLabel(vault, chainId)}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
                        {typeof vault.apy === "number" ? `${vault.apy.toFixed(1)}%` : "—"}
                      </p>
                      <p className="text-[10px] uppercase text-gray-400">APY</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatCompactUsd(vault.tvl)}
                      </p>
                      <p className="text-[10px] uppercase text-gray-400">TVL</p>
                    </div>
                  </div>

                  {/* Mobile stats */}
                  <div className="flex sm:hidden items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-300">
                      {typeof vault.apy === "number" ? `${vault.apy.toFixed(1)}%` : "—"}
                    </span>
                  </div>

                  {/* Action */}
                  <button
                    type="button"
                    onClick={() => onSelectVault(vault)}
                    aria-label={getVaultAccessibilityLabel(vault, chainId)}
                    className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1 motion-reduce:transition-none"
                  >
                    {actionLabel}
                  </button>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </Card>
    </section>
  );
}
