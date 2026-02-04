import React from "react";
import GoalBasedStrategies from "../strategies/GoalBasedStrategies";
import PortfolioRecommendations from "../portfolio/PortfolioRecommendations";
import MultichainPortfolioBreakdown from "../portfolio/MultichainPortfolioBreakdown";
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
          regionData.map((item) => [item.region, totalValue > 0 ? item.value / totalValue : 0])
        )}
        onSelectStrategy={onSelectStrategy}
      />
    </div>
  );
}
