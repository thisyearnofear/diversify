import React, { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { Coin } from "@/components/shared/FloatingCoins";
import { NETWORKS, RH_MAINNET_TOKENS } from "@/config";

interface AssetChip {
  symbol: string;
  name: string;
  badge: string;
  description: string;
}

const ROBINHOOD_ASSETS: AssetChip[] = [
  {
    symbol: "USDG",
    name: "Robinhood USDG",
    badge: "Stable",
    description: "Paxos-issued USD stablecoin backed 1:1 by cash and US Treasuries. A regulated USD parking spot on Robinhood Chain.",
  },
  {
    symbol: "SGOV",
    name: "Short Treasury ETF",
    badge: "Safe Yield",
    description: "iShares 0-3 Month Treasury Bond ETF tokenized on-chain. Near-cash Treasury exposure for idle savings.",
  },
  {
    symbol: "SPY",
    name: "S&P 500 ETF",
    badge: "Hedge",
    description: "SPDR S&P 500 ETF Trust tokenized as an ERC-20. Broad US equity exposure for long-term savers.",
  },
  {
    symbol: "QQQ",
    name: "Nasdaq-100 ETF",
    badge: "Growth",
    description: "Invesco QQQ Trust tokenized on-chain. Tech-heavy growth exposure for those willing to ride more volatility.",
  },
  {
    symbol: "AAPL",
    name: "Apple Stock",
    badge: "Stock",
    description: "Tokenized Apple equity. A single-stock RWA for users who want direct exposure to a specific company.",
  },
  {
    symbol: "TSLA",
    name: "Tesla Stock",
    badge: "Stock",
    description: "Tokenized Tesla equity. High-volatility single-stock exposure for growth-oriented savers.",
  },
];

interface PriceInfo {
  price: number | null;
  isLoading: boolean;
  isLive: boolean;
}

const HEADLINE_PRICE_SYMBOLS = ["USDG", "SPY", "SGOV", "QQQ"];

function useRobinhoodPrices() {
  const [prices, setPrices] = useState<Record<string, PriceInfo>>({});

  useEffect(() => {
    let cancelled = false;
    const tokenAddresses = RH_MAINNET_TOKENS as unknown as Record<string, string>;

    async function fetchPrices() {
      const entries = await Promise.all(
        HEADLINE_PRICE_SYMBOLS.map(async (symbol) => {
          try {
            const address = tokenAddresses[symbol];
            const params = new URLSearchParams({
              chainId: NETWORKS.RH_MAINNET.chainId.toString(),
              symbol,
            });
            if (address) params.set("address", address);
            const res = await fetch(`/api/prices/token?${params.toString()}`);
            if (!res.ok) throw new Error("price fetch failed");
            const json = await res.json();
            return [symbol, { price: json.price ?? null, isLoading: false, isLive: !!json.isLive }];
          } catch {
            return [symbol, { price: null, isLoading: false, isLive: false }];
          }
        })
      );
      if (!cancelled) {
        setPrices(Object.fromEntries(entries));
      }
    }

    setPrices(
      Object.fromEntries(HEADLINE_PRICE_SYMBOLS.map((s) => [s, { price: null, isLoading: true, isLive: false }]))
    );
    fetchPrices();
    return () => {
      cancelled = true;
    };
  }, []);

  return prices;
}

function formatPrice(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

interface AssetDetailModalProps {
  asset: AssetChip;
  price: PriceInfo | undefined;
  onClose: () => void;
}

function AssetDetailModal({ asset, price, onClose }: AssetDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl w-full max-w-sm p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center shadow-lg">
            <TokenIcon symbol={asset.symbol} size={40} />
          </div>
          <div>
            <h3 className="font-black text-xl text-gray-900 dark:text-gray-100">
              {asset.symbol}
            </h3>
            <span className="text-xs font-black uppercase bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-md">
              {asset.badge}
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed font-medium">
          {asset.description}
        </p>

        <div className="mb-5 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-green-600 dark:text-green-400">
            Market price on Robinhood Chain
          </div>
          <div className="mt-1 text-2xl font-black text-green-800 dark:text-green-200 tabular-nums">
            {price?.isLoading ? "Loading…" : formatPrice(price?.price ?? null)}
          </div>
          {!price?.isLive && price?.price != null && (
            <p className="mt-1 text-[10px] text-green-600/80 dark:text-green-400/80">
              Estimated price (fallback feed)
            </p>
          )}
        </div>

        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl mb-6">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 mt-0.5">💡</span>
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              This is a tokenized RWA on Robinhood Chain (chain 4663), an
              Arbitrum Dedicated Blockchain. One-tap swaps are coming next;
              today you can research and track these assets here.
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
        >
          Close
        </button>
      </motion.div>
    </div>
  );
}

interface RobinhoodRwaCardProps {
  onLearnMore?: () => void;
}

export default function RobinhoodRwaCard({ onLearnMore }: RobinhoodRwaCardProps) {
  const [selectedAsset, setSelectedAsset] = useState<AssetChip | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const prices = useRobinhoodPrices();

  useEffect(() => {
    const timer = setTimeout(() => setHasAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: "easeOut" }}
        className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-green-700 to-emerald-900 text-white shadow-lg"
      >
        <div className="relative p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="relative z-10">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                Robinhood Chain RWA
              </div>
              <h3 className="mt-1 text-lg font-black leading-tight">
                Tokenized stocks & insured USDG
              </h3>
              <p className="mt-1 text-sm text-emerald-50/90">
                Diversify into S&P 500, Treasuries, and USDG — all on an Arbitrum L2.
              </p>
            </div>
            <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center">
              <Coin size={56} symbol="$" color="#10b981" variant="selection" />
            </div>
          </div>

          <div className="relative z-10 mt-4 flex flex-wrap gap-2">
            {ROBINHOOD_ASSETS.map((asset, index) => (
              <motion.button
                key={asset.symbol}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={hasAnimated ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.35,
                  delay: prefersReducedMotion ? 0 : index * 0.05,
                  ease: "easeOut",
                }}
                onClick={() => setSelectedAsset(asset)}
                className="group flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-xs font-bold backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
              >
                <TokenIcon symbol={asset.symbol} size={16} />
                <span>{asset.symbol}</span>
                <span className="text-[10px] font-medium text-emerald-200 group-hover:text-white transition">
                  {asset.badge}
                </span>
              </motion.button>
            ))}
          </div>

          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
            {HEADLINE_PRICE_SYMBOLS.map((symbol) => {
              const price = prices[symbol];
              return (
                <div
                  key={symbol}
                  className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur-sm"
                >
                  <div className="text-[10px] font-medium text-emerald-200">{symbol}</div>
                  <div className="text-sm font-black tabular-nums">
                    {price?.isLoading ? "…" : formatPrice(price?.price ?? null)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10 mt-4 flex flex-col gap-2">
            {onLearnMore && (
              <button
                onClick={onLearnMore}
                className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-bold text-white transition hover:bg-white/20 active:scale-[0.98]"
              >
                Ask Advisor about Robinhood RWA
              </button>
            )}
            <p className="text-center text-[10px] text-emerald-200/80">
              One-tap swaps coming next · research & track today
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedAsset && (
          <AssetDetailModal
            asset={selectedAsset}
            price={prices[selectedAsset.symbol]}
            onClose={() => setSelectedAsset(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
