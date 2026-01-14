import React from "react";
import GoalBasedStrategies from "../GoalBasedStrategies";
import PortfolioRecommendations from "../PortfolioRecommendations";
import type { Region } from "@/hooks/use-user-region";

interface StrategiesTabProps {
  userRegion: Region;
  regionData: Array<{ region: string; value: number; color: string }>;
  onSelectStrategy: (strategy: string) => void;
}

export default function StrategiesTab({
  userRegion,
  regionData,
  onSelectStrategy,
}: StrategiesTabProps) {
  return (
    <div className="space-y-4">
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
