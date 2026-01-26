import React, { useState } from "react";
import SimplePieChart from "../portfolio/SimplePieChart";
import CurrencyPerformanceChart from "../portfolio/CurrencyPerformanceChart";
import InflationVisualizer from "../inflation/InflationVisualizer";
import { useDiversification } from "@/hooks/use-diversification";
import { REGION_COLORS } from "@/config";
import type { Region } from "@/hooks/use-user-region";
import { useInflationData } from "@/hooks/use-inflation-data";
import RegionalIconography from "../regional/RegionalIconography";
import { useWalletContext } from "../wallet/WalletProvider";
import WalletButton from "../wallet/WalletButton";
import WealthJourneyWidget from "../demo/WealthJourneyWidget";
import { TabHeader, Card, CollapsibleSection, EmptyState, StatBadge, PrimaryButton } from "../shared/TabComponents";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";

interface OverviewTabProps {
  regionData: Array<{ region: string; value: number; color: string }>;
  regionTotals: Record<string, number>;
  totalValue: number;
  isRegionLoading: boolean;
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  REGIONS: readonly Region[];
  setActiveTab: (tab: string) => void;
  refreshBalances?: () => Promise<void>;
  refreshChainId?: () => Promise<number | null>;
  balances: Record<string, { formattedBalance: string; value: number }>;
  inflationData: Record<string, any>;
  currencyPerformanceData?: any;
  isCurrencyPerformanceLoading?: boolean;
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
  regionTotals,
  totalValue,
  userRegion,
  setUserRegion,
  REGIONS,
  setActiveTab,
  refreshBalances,
  refreshChainId,
  balances,
  currencyPerformanceData,
  isCurrencyPerformanceLoading,
}: OverviewTabProps) {
  const { address, isConnecting, chainId } = useWalletContext();
  const { inflationData } = useInflationData();
  const [selectedMarket, setSelectedMarket] = useState<Region>(userRegion);

  const {
    diversificationScore,
    diversificationRating,
    diversificationDescription,
    diversificationTips,
  } = useDiversification({ regionData, balances, userRegion, inflationData });

  const handleRefresh = async () => {
    if (refreshChainId) await refreshChainId();
    if (refreshBalances) await refreshBalances();
  };

  const hasHoldings = totalValue > 0;
  const activeRegionsCount = regionData.filter((r) => r.value > 0).length;

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
      {/* Main Overview Card */}
      <Card className="space-y-4" padding="p-6">
        <TabHeader
          title="Portfolio Station"
          chainId={chainId}
          onRefresh={refreshBalances ? handleRefresh : undefined}
          onNetworkChange={handleRefresh}
        />

        {!hasHoldings ? (
          <div className="pt-4">
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
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 flex-shrink-0">
                <SimplePieChart data={regionData} title="" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">${totalValue.toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <StatBadge label="Score" value={diversificationScore} color="blue" />
                  <StatBadge label="Regions" value={activeRegionsCount} color="green" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-sm text-gray-900 dark:text-gray-100">{diversificationRating}</span>
                  <span className="text-gray-600 dark:text-gray-400 text-xs">Rating</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <div className="flex-1">
                <PrimaryButton onClick={() => setActiveTab("swap")} fullWidth size="sm">
                  Swap & Protect
                </PrimaryButton>
              </div>
              <button
                onClick={() => setActiveTab("protect")}
                className="flex-1 py-2 px-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold text-xs border border-indigo-100 dark:border-indigo-800 transition-colors"
                aria-label="Ask Oracle"
              >
                Ask Oracle 🤖
              </button>
            </div>
          </div>
        )}
      </Card>

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
                {REGIONS.filter(r => r !== 'Commodity').map((region) => (
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

          {/* Tips Section */}
          {diversificationTips.length > 0 && (
            <CollapsibleSection
              title="Station Insights"
              icon={<span>🧠</span>}
            >
              <div className="space-y-3">
                {diversificationTips.map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm mt-0.5">•</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Personalization */}
          <CollapsibleSection
            title="Station Settings"
            icon={<span>⚙️</span>}
          >
            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-black uppercase text-gray-400 mb-3 flex items-center gap-2">
                  <RegionalIconography region={userRegion} size="sm" />
                  Home Region
                </h4>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.filter(region => region !== 'Commodity').map((region) => (
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
              <WealthJourneyWidget
                totalValue={totalValue}
                setActiveTab={setActiveTab}
                userRegion={userRegion}
              />
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
