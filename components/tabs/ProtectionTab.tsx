import React, { useState } from "react";
import InflationProtectionInfo from "../InflationProtectionInfo";
import RegionalRecommendations from "../RegionalRecommendations";
import AgentWealthGuard from "../AgentWealthGuard";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../WalletProvider";
import { Card, TabHeader, FeatureCard, PrimaryButton, CollapsibleSection, StatBadge } from "../shared/TabComponents";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";

interface ProtectionTabProps {
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  balances: Record<string, { formattedBalance: string; value: number }>;
  setActiveTab?: (tab: string) => void;
}

// RWA asset data (not yields - we don't offer yield)
const RWA_ASSETS = [
  { 
    symbol: "PAXG", 
    type: "Store of Value", 
    label: "Inflation Hedge",
    description: "Tokenized physical gold backed 1:1 by London Good Delivery gold bars held in Brink's vaults. Each PAXG token = 1 troy ounce of gold.",
    benefits: ["No storage fees", "Redeemable for physical gold", "24/7 trading"]
  },
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
  const isCelo = ChainDetectionService.isCelo(chainId);
  const isArbitrum = ChainDetectionService.isArbitrum(chainId);
  const [showAssetModal, setShowAssetModal] = useState<string | null>(null);

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
          showNetworkSwitcher={true}
        />

        {/* Quick Stats */}
        <div className="flex gap-2 mb-4">
          <StatBadge label="Portfolio" value={`$${totalValue.toFixed(0)}`} color="blue" />
          <StatBadge label="Regions" value={currentRegions.length} color="green" />
          <StatBadge label="Strategy" value={isArbitrum ? "RWA" : "Stables"} color="gray" />
        </div>

        {/* Network-specific guidance */}
        {isCelo ? (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-3 rounded-lg border border-green-100 mb-3">
            <p className="text-sm text-gray-700 mb-1">
              <strong>🌍 Celo Stablecoins</strong> — Swap between regional currencies (cUSD, cEUR, cKES, cREAL) to hedge against local inflation.
            </p>
            <p className="text-xs text-gray-500">
              Want gold-backed assets? Switch to Arbitrum above.
            </p>
          </div>
        ) : isArbitrum ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg border border-blue-100 mb-3">
            <p className="text-sm text-gray-700 mb-1">
              <strong>🔷 Arbitrum RWAs</strong> — Hold tokenized real-world assets like gold (PAXG) as a store of value.
            </p>
            <p className="text-xs text-gray-500">
              Want regional stablecoins? Switch to Celo above.
            </p>
          </div>
        ) : null}
      </Card>

      {/* RWA Assets - Premium Feature Card */}
      <FeatureCard
        title="🏛️ Real-World Assets"
        badge={<span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Arbitrum</span>}
        variant="premium"
      >
        <div className="space-y-2 mb-3">
          {RWA_ASSETS.map((item) => (
            <button
              key={item.symbol}
              onClick={() => setShowAssetModal(item.symbol)}
              className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-left hover:bg-white/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏆</span>
                    <span className="text-sm font-bold text-white">{item.symbol}</span>
                    <span className="text-xs text-blue-200/60 bg-white/10 px-2 py-0.5 rounded">{item.type}</span>
                  </div>
                  <div className="text-xs text-blue-200 mt-1">{item.label}</div>
                </div>
                <span className="text-blue-200/60 text-xs">ⓘ Learn more</span>
              </div>
            </button>
          ))}
        </div>
        
        {isCelo && (
          <PrimaryButton onClick={handleNavigateToSwap} fullWidth size="sm" icon={<span>🌉</span>}>
            Bridge to Arbitrum
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

      {/* Asset Info Modal */}
      {showAssetModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAssetModal(null)}>
          <div className="bg-white rounded-xl max-w-sm w-full p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {RWA_ASSETS.filter(a => a.symbol === showAssetModal).map(asset => (
              <div key={asset.symbol}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🏆</span>
                  <div>
                    <h3 className="font-bold text-lg">{asset.symbol}</h3>
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{asset.type}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">{asset.description}</p>
                <div className="space-y-2 mb-4">
                  {asset.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setShowAssetModal(null)}
                  className="w-full py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
          embedded={true}
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
