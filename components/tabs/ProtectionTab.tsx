import React from "react";
import InflationProtectionInfo from "../InflationProtectionInfo";
import RegionalRecommendations from "../RegionalRecommendations";
import AgentWealthGuard from "../AgentWealthGuard";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../WalletProvider";
import { Card, TabHeader, FeatureCard, PrimaryButton, CollapsibleSection, StatBadge } from "../shared/TabComponents";
import { NETWORKS } from "@/config";

interface ProtectionTabProps {
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  balances: Record<string, { formattedBalance: string; value: number }>;
  setActiveTab?: (tab: string) => void;
}

// RWA yield data
const RWA_YIELDS = [
  { symbol: "OUSG", apy: "5.2%", label: "T-Bills", description: "US Treasury Bonds" },
  { symbol: "USDY", apy: "4.8%", label: "Yield USD", description: "Yield-bearing stablecoin" },
  { symbol: "PAXG", apy: "—", label: "Gold", description: "Tokenized physical gold" },
];

export default function ProtectionTab({
  userRegion,
  setUserRegion,
  regionData,
  totalValue,
  balances,
  setActiveTab
}: ProtectionTabProps) {
  const { chainId } = useWalletContext();
  const isCelo = chainId === NETWORKS.CELO_MAINNET.chainId || chainId === NETWORKS.ALFAJORES.chainId;
  const isArbitrum = chainId === NETWORKS.ARBITRUM_ONE.chainId;

  const currentRegions = regionData
    .filter((item) => item.value > 0)
    .map((item) => item.region as Region);

  const currentAllocations = Object.fromEntries(
    regionData.map((item) => [item.region, item.value / 100])
  );

  const handleNavigateToSwap = () => {
    if (setActiveTab) setActiveTab("swap");
  };

  return (
    <div className="space-y-4">
      {/* Main Protection Card */}
      <Card>
        <TabHeader
          title="Protection"
          chainId={chainId}
          showNetworkSwitcher={false}
        />

        {/* Quick Stats */}
        <div className="flex gap-2 mb-4">
          <StatBadge label="Portfolio" value={`$${totalValue.toFixed(0)}`} color="blue" />
          <StatBadge label="Regions" value={currentRegions.length} color="green" />
          <StatBadge label="Strategy" value={isArbitrum ? "RWA" : "Stables"} color="gray" />
        </div>

        {/* Primary CTA based on network */}
        {isCelo ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-100">
            <p className="text-sm text-gray-700 mb-2">
              Access higher yields with Real-World Assets on Arbitrum.
            </p>
            <PrimaryButton onClick={handleNavigateToSwap} icon={<span>🌉</span>} size="sm">
              Bridge to Arbitrum
            </PrimaryButton>
          </div>
        ) : isArbitrum ? (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-100">
            <p className="text-sm text-gray-700 mb-2">
              You&apos;re on Arbitrum — explore yield-bearing RWAs below.
            </p>
          </div>
        ) : null}
      </Card>

      {/* RWA Yields - Premium Feature Card */}
      <FeatureCard
        title="🏛️ RWA Vaults"
        badge={<span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Live Yields</span>}
        variant="premium"
      >
        <div className="grid grid-cols-3 gap-2 mb-3">
          {RWA_YIELDS.map((item) => (
            <div key={item.symbol} className="bg-white/10 border border-white/20 rounded-lg p-2 text-center">
              <div className="text-xs text-blue-200 font-bold">{item.symbol}</div>
              <div className="text-lg font-black text-white">{item.apy}</div>
              <div className="text-xs text-blue-200/60">{item.label}</div>
            </div>
          ))}
        </div>
        
        {isCelo && (
          <PrimaryButton onClick={handleNavigateToSwap} fullWidth size="sm" icon={<span>🌉</span>}>
            Bridge to Invest
          </PrimaryButton>
        )}

        <div className="flex items-center justify-between mt-3 text-xs text-blue-200/60">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            Low Gas ($0.50-$2)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
            Arbitrum One
          </span>
        </div>
      </FeatureCard>

      {/* AI Wealth Guard - Collapsible */}
      <CollapsibleSection
        title="AI Wealth Guard"
        icon={<span>🤖</span>}
        badge={<span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI</span>}
        defaultOpen={totalValue > 0}
      >
        <AgentWealthGuard
          amount={totalValue || 0}
          holdings={Object.keys(balances || {})}
          onExecuteSwap={handleNavigateToSwap}
        />
      </CollapsibleSection>

      {/* Inflation Protection Info - Collapsible */}
      <CollapsibleSection
        title="Inflation Analysis"
        icon={<span>📊</span>}
      >
        <InflationProtectionInfo
          homeRegion={userRegion}
          currentRegions={currentRegions}
          amount={totalValue || 1000}
          onChangeHomeRegion={setUserRegion}
        />
      </CollapsibleSection>

      {/* Regional Recommendations - Collapsible */}
      <CollapsibleSection
        title="Regional Recommendations"
        icon={<span>🌍</span>}
      >
        <RegionalRecommendations
          userRegion={userRegion}
          currentAllocations={currentAllocations}
        />
      </CollapsibleSection>
    </div>
  );
}
