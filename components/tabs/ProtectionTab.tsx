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

