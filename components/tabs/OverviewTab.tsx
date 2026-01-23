import React from "react";
import SimplePieChart from "../SimplePieChart";
import { useDiversification } from "@/hooks/use-diversification";
import { REGION_COLORS } from "@/constants/regions";
import type { Region } from "@/hooks/use-user-region";
import type { RegionalInflationData } from "@/hooks/use-inflation-data";
import RegionalIconography from "../RegionalIconography";
import { useWalletContext } from "../WalletProvider";
import WalletButton from "../WalletButton";
import WealthJourneyWidget from "../WealthJourneyWidget";
import { TabHeader, Card, CollapsibleSection, EmptyState, StatBadge, PrimaryButton, SecondaryButton } from "../shared/TabComponents";
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
  inflationData: Record<string, RegionalInflationData>;
}

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
  inflationData,
}: OverviewTabProps) {
  const { address, isConnecting, chainId } = useWalletContext();
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
  const activeRegions = regionData.filter((r) => r.value > 0).length;

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
      {/* Main Overview Card with better spacing */}
      <Card className="space-y-4" padding="p-6">
        <TabHeader
          title="Portfolio"
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
            {/* Portfolio Summary with more breathing room */}
            <div className="flex items-start gap-8 -mt-4">
              <div className="w-32 h-32 flex-shrink-0">
                <SimplePieChart data={regionData} title="" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-gray-900">${totalValue.toFixed(2)}</span>
                  <span className="text-base text-gray-500">total value</span>
                </div>
                <div className="flex gap-4">
                  <StatBadge label="Score" value={`${diversificationScore}/100`} color="blue" />
                  <StatBadge label="Regions" value={activeRegions} color="green" />
                </div>

                {/* Compact Diversification Rating */}
                <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-gray-900 dark:text-gray-100">{diversificationRating}</span>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Protection</span>
                  </div>
                  <button
                    onClick={() => setActiveTab("swap")}
                    className="text-xs bg-blue-600 dark:bg-blue-700 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
                  >
                    Improve →
                  </button>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">{diversificationDescription}</p>
              </div>
            </div>

            {/* Quick Actions - Right aligned with proper sizing */}
            <div className="flex justify-end gap-3">
              <PrimaryButton onClick={() => setActiveTab("swap")} size="md">
                Swap
              </PrimaryButton>
              <SecondaryButton onClick={() => setActiveTab("analytics")} size="md">
                Analytics
              </SecondaryButton>
            </div>
          </div>
        )}
      </Card>

      {/* Consolidated Sections - Only Two */}
      {hasHoldings && (
        <div className="space-y-4">
          {/* Portfolio Details - Combines Regional Breakdown + Recommendations */}
          <CollapsibleSection
            title="Portfolio Details"
            icon={<span className="text-lg">📊</span>}
            badge={<span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">{activeRegions} regions</span>}
          >
            <div className="space-y-6">
              {/* Regional Breakdown */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <span className="text-base">🌍</span>
                  Regional Distribution
                </h4>
                <div className="space-y-3">
                  {Object.entries(regionTotals).map(([region, value]) => (
                    <div key={region} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: REGION_COLORS[region as keyof typeof REGION_COLORS] }}
                        />
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{region}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">${value.toFixed(2)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {((value / totalValue) * 100).toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              {diversificationTips.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                    <span className="text-base">💡</span>
                    Optimization Tips
                  </h4>
                  <div className="space-y-3">
                    {diversificationTips.slice(0, 3).map((tip, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-sm mt-0.5">•</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Personal Settings - Combines Wealth Journey + Home Region */}
          <CollapsibleSection
            title="Personal Settings"
            icon={<span className="text-lg">⚙️</span>}
          >
            <div className="space-y-6">
              {/* Home Region Selection */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <RegionalIconography region={userRegion} size="sm" />
                  Home Region
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
                  Select your home region to personalize inflation data and recommendations.
                </p>
                <div className="flex flex-wrap gap-2">
                  {REGIONS.filter(region => region !== 'Commodity').map((region) => (
                    <button
                      key={region}
                      onClick={() => setUserRegion(region)}
                      className={`px-4 py-2 text-sm rounded-full transition-colors ${userRegion === region
                        ? "bg-blue-600 text-white font-medium"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                        }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              {/* Wealth Journey */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <span className="text-base">🎯</span>
                  Wealth Journey
                </h4>
                <WealthJourneyWidget
                  totalValue={totalValue}
                  setActiveTab={setActiveTab}
                  userRegion={userRegion}
                />
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
