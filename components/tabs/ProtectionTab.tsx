import React, { useState } from "react";
import InflationProtectionInfo from "../inflation/InflationProtectionInfo";
import RegionalRecommendations from "../regional/RegionalRecommendations";
import AgentWealthGuard from "../agent/AgentWealthGuard";
import GoalBasedStrategies from "../strategies/GoalBasedStrategies";
import PortfolioRecommendations from "../portfolio/PortfolioRecommendations";
import MultichainPortfolioBreakdown from "../portfolio/MultichainPortfolioBreakdown";
import type { Region } from "@/hooks/use-user-region";
import { useWalletContext } from "../wallet/WalletProvider";
import { Card, TabHeader, FeatureCard, PrimaryButton, CollapsibleSection, StatBadge } from "../shared/TabComponents";
import { ChainDetectionService } from "@/services/swap/chain-detection.service";

interface ProtectionTabProps {
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  balances: Record<string, { formattedBalance: string; value: number }>;
  setActiveTab?: (tab: string) => void;
  onSelectStrategy?: (strategy: string) => void;
}

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
  setActiveTab,
  onSelectStrategy
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

  return (
    <div className="space-y-4">
      {/* Oracle Hero Card */}
      <Card padding="p-0 overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight">AI Wealth Oracle</h3>
              <p className="text-indigo-100 text-xs font-bold opacity-80 mt-1">Autonomous Multi-Chain Protection</p>
            </div>
            <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30">
              <span className="text-2xl">🤖</span>
            </div>
          </div>

          <div className="flex gap-2">
            <StatBadge label="Total Protected" value={`$${totalValue.toFixed(0)}`} color="white" />
            <StatBadge label="Exposure" value={`${currentRegions.length} Regions`} color="white" />
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Multichain Portfolio Breakdown Restored */}
          {totalValue > 0 && (
            <CollapsibleSection
              title="Chain Distribution"
              icon={<span>🔗</span>}
              defaultOpen={false}
            >
              <MultichainPortfolioBreakdown
                regionData={regionData}
                totalValue={totalValue}
              />
            </CollapsibleSection>
          )}

          {isArbitrum ? (
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <span className="text-xl">🔷</span>
              <p className="text-xs text-blue-800 dark:text-blue-200 font-bold">You are protecting wealth via <span className="underline">Real World Assets</span> on Arbitrum.</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
              <span className="text-xl">🌍</span>
              <p className="text-xs text-emerald-800 dark:text-emerald-200 font-bold">You are protecting wealth via <span className="underline">Regional Stablecoins</span> on Celo.</p>
            </div>
          )}

          <AgentWealthGuard
            amount={totalValue || 0}
            holdings={Object.keys(balances || {})}
            embedded={true}
            onExecute={(token) => setActiveTab?.('swap')}
          />
        </div>
      </Card>

      {/* RWA Assets Card */}
      <FeatureCard
        title="🏛️ Tokenized Gold"
        badge={<span className="text-[10px] font-black bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Arbitrum</span>}
        variant="premium"
      >
        <p className="text-xs text-blue-100/80 font-bold mb-4 leading-relaxed">Escape fiat inflation by holding PAXG. Secure, audited, and redeemable for physical bars.</p>
        <div className="space-y-2 mb-4">
          {RWA_ASSETS.map((item) => (
            <button
              key={item.symbol}
              onClick={() => setShowAssetModal(item.symbol)}
              className="w-full bg-white/20 border border-white/30 rounded-xl p-4 text-left hover:bg-white/30 transition-all active:scale-[0.98] group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-400 rounded-lg flex items-center justify-center text-xl shadow-lg group-hover:rotate-12 transition-transform">🏆</div>
                  <div>
                    <div className="text-sm font-black text-white">{item.symbol}</div>
                    <div className="text-[10px] text-blue-200 font-bold uppercase tracking-widest">{item.label}</div>
                  </div>
                </div>
                <span className="text-blue-200/60 text-[10px] font-bold uppercase border border-white/20 px-2 py-1 rounded">Details →</span>
              </div>
            </button>
          ))}
        </div>

        {isCelo && (
          <PrimaryButton onClick={() => setActiveTab?.('swap')} fullWidth size="md">
            Bridge to Arbitrum
          </PrimaryButton>
        )}
      </FeatureCard>

      {/* Strategies */}
      <CollapsibleSection
        title="Goal-Based Strategies"
        icon={<span>🎯</span>}
        defaultOpen={false}
      >
        <div className="space-y-4">
          <GoalBasedStrategies
            userRegion={userRegion}
            onSelectStrategy={onSelectStrategy || (() => { })}
          />
          <PortfolioRecommendations
            currentAllocations={currentAllocations}
            onSelectStrategy={onSelectStrategy || (() => { })}
          />
        </div>
      </CollapsibleSection>

      {/* Inflation Analysis */}
      <CollapsibleSection
        title="Regional Protection Data"
        icon={<span>📊</span>}
      >
        <InflationProtectionInfo
          homeRegion={userRegion}
          currentRegions={currentRegions}
          amount={totalValue || 1000}
          onChangeHomeRegion={setUserRegion}
        />
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <RegionalRecommendations
            userRegion={userRegion}
            currentAllocations={currentAllocations}
          />
        </div>
      </CollapsibleSection>

      {/* Asset Info Modal */}
      {showAssetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAssetModal(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {RWA_ASSETS.filter(a => a.symbol === showAssetModal).map(asset => (
              <div key={asset.symbol}>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-4xl shadow-inner">🏆</div>
                  <div>
                    <h3 className="font-black text-xl text-gray-900 dark:text-gray-100">{asset.symbol}</h3>
                    <span className="text-[10px] font-black uppercase bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-md">{asset.type}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed font-medium">{asset.description}</p>
                <div className="space-y-3 mb-8">
                  {asset.benefits.map((benefit, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-white/5 p-3 rounded-xl border border-gray-100 dark:border-white/5 font-bold">
                      <span className="text-green-500 text-lg">✓</span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAssetModal(null)}
                    className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-200 transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => { setShowAssetModal(null); setActiveTab?.('swap'); }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/30"
                  >
                    Get PAXG
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
