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
            {/* Portfolio Summary with better spacing */}
            <div className="flex items-center gap-6">
              <div className="w-28 h-28 flex-shrink-0">
                <SimplePieChart data={regionData} title="" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-3xl font-bold text-gray-900">${totalValue.toFixed(2)}</span>
                  <span className="text-sm text-gray-500">total</span>
                </div>
                <div className="flex gap-3">
                  <StatBadge label="Score" value={`${diversificationScore}/100`} color="blue" />
                  <StatBadge label="Regions" value={activeRegions} color="green" />
                </div>
              </div>
            </div>

            {/* Diversification Rating with better spacing */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-bold text-lg text-gray-900">{diversificationRating}</span>
                  <span className="text-gray-600 text-sm ml-2">Protection</span>
                </div>
                <button
                  onClick={() => setActiveTab("swap")}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition-colors"
                >
                  Improve →
                </button>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{diversificationDescription}</p>
            </div>

            {/* Quick Actions with better spacing */}
            <div className="flex gap-3 pt-2">
              <PrimaryButton onClick={() => setActiveTab("swap")} fullWidth size="lg">
                Swap
              </PrimaryButton>
              <SecondaryButton onClick={() => setActiveTab("analytics")} fullWidth size="lg">
                Analytics
              </SecondaryButton>
            </div>
          </div>
        )}
      </Card>

      {/* Progressive Disclosure Sections with better spacing */}
      {hasHoldings && (
        <div className="space-y-4">
          {/* Regional Breakdown - Collapsible */}
          <CollapsibleSection
            title="Regional Breakdown"
            icon={<span className="text-lg">🌍</span>}
            badge={<span className="text-xs bg-gray-100 px-2 py-1 rounded-full">{activeRegions} regions</span>}
          >
            <div className="space-y-3">
              {Object.entries(regionTotals).map(([region, value]) => (
                <div key={region} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{ backgroundColor: REGION_COLORS[region as keyof typeof REGION_COLORS] }}
                    />
                    <span className="text-sm font-medium text-gray-900">{region}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">${value.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">
                      {((value / totalValue) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Recommendations - Collapsible */}
          {diversificationTips.length > 0 && (
            <CollapsibleSection
              title="Recommendations"
              icon={<span className="text-lg">💡</span>}
            >
              <div className="space-y-3">
                {diversificationTips.slice(0, 3).map((tip, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <span className="text-blue-600 font-bold text-sm mt-0.5">•</span>
                    <span className="text-sm text-gray-700 leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Wealth Journey - Collapsible */}
          <CollapsibleSection
            title="Wealth Journey"
            icon={<span className="text-lg">🎯</span>}
          >
            <div className="pt-2">
              <WealthJourneyWidget
                totalValue={totalValue}
                setActiveTab={setActiveTab}
                userRegion={userRegion}
              />
            </div>
          </CollapsibleSection>

          {/* Home Region - Collapsible */}
          <CollapsibleSection
            title="Home Region"
            icon={<RegionalIconography region={userRegion} size="sm" />}
          >
            <div className="space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Select your home region to personalize inflation data and recommendations.
              </p>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((region) => (
                  <button
                    key={region}
                    onClick={() => setUserRegion(region)}
                    className={`px-4 py-2 text-sm rounded-full transition-colors ${userRegion === region
                      ? "bg-blue-600 text-white font-medium"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </div>
  );
}
