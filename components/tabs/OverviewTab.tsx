import React, { useState } from "react";
import CurrencyPerformanceChart from "../portfolio/CurrencyPerformanceChart";
import InflationVisualizer from "../inflation/InflationVisualizer";
import { useDiversification } from "@/hooks/use-diversification";
import { usePortfolioYield } from "@/hooks/use-portfolio-yield";
import ProtectionAnalysis from "../portfolio/ProtectionAnalysis";
import type { Region } from "@/hooks/use-user-region";
import { useInflationData } from "@/hooks/use-inflation-data";
import RegionalIconography from "../regional/RegionalIconography";
import { useWalletContext } from "../wallet/WalletProvider";
import WalletButton from "../wallet/WalletButton";

import { Card, CollapsibleSection, EmptyState } from "../shared/TabComponents";
import { SmartBuyCryptoButton } from "../onramp";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";

interface OverviewTabProps {
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  isRegionLoading: boolean;
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  REGIONS: readonly Region[];
  setActiveTab: (tab: string) => void;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  balances: Record<string, { formattedBalance: string; value: number }>;
  inflationData: Record<string, unknown>;
  currencyPerformanceData?: {
    dates: string[];
    currencies: {
      symbol: string;
      name: string;
      region: Region;
      values: number[];
      percentChange: number;
    }[];
    baseCurrency: string;
    source?: "api" | "cache" | "fallback";
  };
}

const EMERGING_MARKETS = {
  Africa: { growth: 4.2, highlight: "Fastest growing mobile money market" },
  LatAm: { growth: 3.1, highlight: "Leading fintech adoption" },
  Asia: { growth: 5.3, highlight: "60% of global digital payments" },
  USA: { growth: 2.1, highlight: "World reserve currency" },
  Europe: { growth: 1.8, highlight: "Strong regulatory framework" },
};

export default function OverviewTab({
  regionData,
  totalValue,
  userRegion,
  setUserRegion,
  REGIONS,
  setActiveTab,
  refreshBalances,
  refreshChainId,
  balances,
  currencyPerformanceData,
}: OverviewTabProps) {
  const { address, isConnecting, chainId } = useWalletContext();
  const { inflationData } = useInflationData();
  const [selectedMarket, setSelectedMarket] = useState<Region>(userRegion);

  const {
    diversificationScore,
    diversificationRating,
    diversificationTips,
    goalScores,
  } = useDiversification({ regionData, balances, userRegion, inflationData });

  // Calculate yield vs inflation for Net Protection display
  const yieldSummary = usePortfolioYield(balances, inflationData);

  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
  };

  const hasHoldings = totalValue > 0;

  const selectedMarketData = EMERGING_MARKETS[selectedMarket as keyof typeof EMERGING_MARKETS] || EMERGING_MARKETS.Africa;
  const selectedMarketInflation = inflationData[selectedMarket]?.avgRate || 0;

  // Not connected state
  if (!address && !isConnecting) {
    return (
      <div className="space-y-4">
        <Card className="text-center">
          <EmptyState
            icon={<RegionalIconography region={userRegion} size="lg" />}
            title="Protect Your Savings"
            description="Diversify stablecoins across regions to hedge against inflation"
          />
          <div className="mt-4">
            <WalletButton variant="inline" className="w-full" />
          </div>
        </Card>
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className="space-y-4">
        <Card className="text-center py-8">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full mb-4 flex items-center justify-center">
              <svg className="animate-spin w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-gray-600">Connecting wallet...</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!hasHoldings ? (
        <Card className="space-y-4" padding="p-6">
          <div className="pt-4 space-y-4">
            <EmptyState
              icon="💰"
              title={ChainDetectionService.isArbitrum(chainId) ? "No RWAs Found" : "No Stablecoins Found"}
              description={ChainDetectionService.isArbitrum(chainId)
                ? "Bridge assets to access Real-World Assets like Gold and Treasuries."
                : "Deposit funds to start protecting your savings from inflation."
              }
              action={{
                label: ChainDetectionService.isArbitrum(chainId) ? "Bridge Assets" : "Get Started",
                onClick: () => setActiveTab("swap"),
                icon: <span>{ChainDetectionService.isArbitrum(chainId) ? "🌉" : "➕"}</span>,
              }}
            />

            {/* Fiat On-ramp Option */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🏦</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm">New to Crypto?</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-3">
                    Buy crypto instantly with your bank card or bank transfer. No KYC required under limits.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <SmartBuyCryptoButton />
                    <button
                      onClick={() => setActiveTab("swap")}
                      className="px-4 py-2.5 rounded-xl font-medium text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Bridge Instead
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">Powered by Mt Pelerin • Swiss-regulated</p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <ProtectionAnalysis
          regionData={regionData}
          totalValue={totalValue}
          goalScores={goalScores}
          diversificationScore={diversificationScore}
          diversificationRating={diversificationRating}
          onOptimize={() => setActiveTab("protect")}
          onSwap={() => setActiveTab("swap")}
          chainId={chainId}
          onNetworkChange={refreshChainId ? handleRefresh : undefined}
          refreshBalances={refreshBalances}
          yieldSummary={yieldSummary}
        />
      )}

      {hasHoldings && (
        <div className="space-y-4">
          {/* Market Deep Dive - Restored Interactivity */}
          <CollapsibleSection
            title="Global Market Dive"
            icon={<span>🌍</span>}
            defaultOpen={false}
          >
            <div className="space-y-6">
              {/* Region Selector */}
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    onClick={() => setSelectedMarket(region)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all ${region === selectedMarket
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                      }`}
                  >
                    {region}
                  </button>
                ))}
              </div>

              {/* Market Insight & Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
                  <div className="text-[10px] font-black text-blue-500 uppercase mb-1">Inflation</div>
                  <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{selectedMarketInflation.toFixed(1)}%</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800">
                  <div className="text-[10px] font-black text-emerald-500 uppercase mb-1">Growth</div>
                  <div className="text-lg font-bold text-emerald-900 dark:text-emerald-100">+{selectedMarketData.growth}%</div>
                </div>
              </div>

              <div className="p-3 bg-gray-900 rounded-xl text-white text-[11px] font-bold italic">
                &quot;{selectedMarketData.highlight}&quot;
              </div>

              {/* Inflation Visualizer Restored */}
              <InflationVisualizer
                region={selectedMarket}
                inflationRate={selectedMarketInflation}
                years={5}
                initialAmount={100}
              />

              {/* Performance Chart */}
              {currencyPerformanceData && (
                <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                  <div className="text-[10px] font-black text-gray-400 uppercase mb-3">Currency Velocity (30D)</div>
                  <CurrencyPerformanceChart
                    data={currencyPerformanceData}
                    title=""
                  />
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Settings & Insights - Consolidated */}
          <CollapsibleSection
            title="Settings & Insights"
            icon={<span>🧠</span>}
          >
            <div className="space-y-6">
              {/* Tips Section */}
              {diversificationTips.length > 0 && (
                <div>
                  <h4 className="text-xs font-black uppercase text-gray-400 mb-3 flex items-center gap-2">
                    <span>💡</span>
                    Insights
                  </h4>
                  <div className="space-y-3">
                    {diversificationTips.map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-sm mt-0.5">•</span>
                        <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Home Region Selector */}
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 mb-3 flex items-center gap-2">
                  <RegionalIconography region={userRegion} size="sm" />
                  Home Region
                </h4>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.map((region) => (
                    <button
                      key={region}
                      onClick={() => setUserRegion(region)}
                      className={`px-3 py-1.5 text-xs rounded-full transition-all font-bold ${userRegion === region
                        ? "bg-blue-600 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                        }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
