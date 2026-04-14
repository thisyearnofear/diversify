import React, { useEffect, useState } from "react";
import { EarnService, type EarnVault } from "@diversifi/shared";
import { motion, AnimatePresence } from "framer-motion";
import { Skeleton } from "../shared/TabComponents";

interface YieldDiscoverySectionProps {
  chainId?: number;
  onSelectVault: (vault: EarnVault) => void;
  limit?: number;
  title?: string;
  className?: string;
}

export default function YieldDiscoverySection({
  chainId,
  onSelectVault,
  limit = 3,
  title = "High-Yield Protection",
  className = "",
}: YieldDiscoverySectionProps) {
  const [vaults, setVaults] = useState<EarnVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadVaults() {
      setLoading(true);
      try {
        // LI.FI Earn discovery
        const data = await EarnService.fetchVaults({
          chainIds: chainId ? [chainId] : undefined,
        });
        
        // Filter and sort by APY
        const sorted = data
          .filter(v => v.status === 'active')
          .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))
          .slice(0, limit);
          
        setVaults(sorted);
        setError(null);
      } catch (err) {
        console.error("[YieldDiscovery] Failed to load vaults:", err);
        setError("Unable to load yield opportunities");
      } finally {
        setLoading(false);
      }
    }

    loadVaults();
  }, [chainId, limit]);

  if (loading) {
    return (
      <div className={`space-y-3 ${className}`}>
        <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">{title}</h4>
        {[...Array(limit)].map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" variant="rect" />
        ))}
      </div>
    );
  }

  if (error || vaults.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase text-gray-400 tracking-widest">{title}</h4>
        <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">Powered by LI.FI</span>
      </div>
      
      <div className="grid gap-3">
        <AnimatePresence>
          {vaults.map((vault, i) => (
            <motion.div
              key={vault.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center border border-gray-100 dark:border-gray-700">
                    {vault.asset.logoURI ? (
                      <img src={vault.asset.logoURI} alt={vault.asset.symbol} className="w-6 h-6 rounded-full" />
                    ) : (
                      <span className="text-lg">💰</span>
                    )}
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                      {vault.protocol} {vault.asset.symbol}
                    </h5>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{vault.chainId === 42161 ? 'Arbitrum' : 'Celo'}</span>
                      <span className="text-[10px] text-emerald-500 font-black">
                        {typeof vault.tvl === "number"
                          ? `TVL: $${(vault.tvl / 1000000).toFixed(1)}M`
                          : "TVL on quote"}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-black text-emerald-500">
                    {typeof vault.apy === "number" ? `${vault.apy.toFixed(2)}%` : "Live"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                    {typeof vault.apy === "number" ? "APY" : "Quote"}
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => onSelectVault(vault)}
                className="w-full mt-3 py-2 bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
              >
                One-Click Deposit
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
