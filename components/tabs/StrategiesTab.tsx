import React from "react";
import GoalBasedStrategies from "../GoalBasedStrategies";
import PortfolioRecommendations from "../PortfolioRecommendations";
import MultichainPortfolioBreakdown from "../MultichainPortfolioBreakdown";
import type { Region } from "@/hooks/use-user-region";

interface StrategiesTabProps {
  userRegion: Region;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  onSelectStrategy: (strategy: string) => void;
}

export default function StrategiesTab({
  userRegion,
  regionData,
  totalValue,
  onSelectStrategy,
}: StrategiesTabProps) {
  return (
    <div className="space-y-4">
      {/* Multichain Portfolio Breakdown */}
      <MultichainPortfolioBreakdown
        regionData={regionData}
        totalValue={totalValue}
      />

      {/* Goal-Based Strategies */}
      <GoalBasedStrategies
        userRegion={userRegion}
        onSelectStrategy={onSelectStrategy}
      />

      {/* Portfolio Strategies */}
      <PortfolioRecommendations
        currentAllocations={Object.fromEntries(
          regionData.map((item) => [item.region, item.value / 100])
        )}
        onSelectStrategy={onSelectStrategy}
      />
    </div>
  );
}
