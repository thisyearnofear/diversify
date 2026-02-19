import React from "react";
import RealWorldUseCases, { GOAL_TYPES } from "../demo/RealWorldUseCases";
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
  // Handle goal selection - maps to the recommended strategy
  const handleGoalSelect = (goalId: string) => {
    const goal = GOAL_TYPES.find((g) => g.id === goalId);
    if (goal) {
      onSelectStrategy(goal.recommendedStrategy);
    }
  };

  return (
    <div className="space-y-4">
      {/* Multichain Portfolio Breakdown */}
      <MultichainPortfolioBreakdown
        regionData={regionData}
        totalValue={totalValue}
      />

      {/* Interactive Goal Selector (consolidated from GoalBasedStrategies) */}
      <RealWorldUseCases
        focusRegion={userRegion}
        onSelectGoal={handleGoalSelect}
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
