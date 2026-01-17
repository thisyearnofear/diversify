import React from "react";
import InflationProtectionInfo from "../InflationProtectionInfo";
import RegionalRecommendations from "../RegionalRecommendations";
import AgentWealthGuard from "../AgentWealthGuard";
import type { Region } from "@/hooks/use-user-region";

interface ProtectionTabProps {
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  balances: any;
  setActiveTab?: (tab: string) => void;
}

export default function ProtectionTab({
  userRegion,
  setUserRegion,
  regionData,
  totalValue,
  balances,
  setActiveTab
}: ProtectionTabProps) {
  // Convert regionData to the format needed by our components
  const currentRegions = Object.entries(regionData)
    .filter(([_, data]) => data.value > 0)
    .map(([region]) => region as Region);

  const currentAllocations = Object.fromEntries(
    regionData.map((item) => [item.region, item.value / 100])
  );

  const handleAgentSwap = (targetToken: string) => {
    // In a real implementation, we would pass the target token to the SwapTab
    // For now, we just switch to the tab. 
    // Ideally, we would use a global state manager (Zustand/Context) to set the 'toToken'
    if (setActiveTab) {
      setActiveTab("swap");
    } else {
      console.warn("Navigation not available");
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium RWA Yield Opportunities - HOT ZONE */}
      <div className="bg-gradient-to-br from-blue-900 to-indigo-900 rounded-2xl p-4 shadow-xl border border-blue-500/30 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
        <div className="relative">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏛️</span>
              <h3 className="text-white font-bold text-sm tracking-tight">ARBITRUM RWA VAULTS</h3>
            </div>
            <span className="text-[10px] font-bold bg-blue-500 text-white px-2 py-0.5 rounded-full animate-pulse">LIVE YIELDS</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { symbol: 'OUSG', apy: '5.2%', label: 'T-Bills' },
              { symbol: 'USDY', apy: '4.8%', label: 'Yield USD' },
              { symbol: 'GLP', apy: '12.5%', label: 'Real Yield' }
            ].map((yieldItem) => (
              <div key={yieldItem.symbol} className="bg-white/5 border border-white/10 rounded-xl p-2 text-center">
                <div className="text-[10px] text-blue-300 font-bold mb-1">{yieldItem.symbol}</div>
                <div className="text-sm font-black text-white">{yieldItem.apy}</div>
                <div className="text-[8px] text-blue-200/50 uppercase tracking-wider">{yieldItem.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-[10px] text-blue-200/60 font-medium">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Low Gas Fees ($0.50-$2.00)
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
              x402 Verified
            </div>
          </div>
        </div>
      </div>

      {/* Agentic Wealth Protection - PREMIUM UI */}
      <AgentWealthGuard
        amount={totalValue || 0}
        currentRegions={currentRegions}
        holdings={Object.keys(balances || {})}
        userRegion={userRegion}
        onExecuteSwap={handleAgentSwap}
      />

      {/* Inflation Protection Info */}
      <InflationProtectionInfo
        homeRegion={userRegion}
        currentRegions={currentRegions}
        amount={totalValue || 1000}
        onChangeHomeRegion={setUserRegion}
      />

      {/* Regional Recommendations */}
      <RegionalRecommendations
        userRegion={userRegion}
        currentAllocations={currentAllocations}
      />
    </div>
  );
}

