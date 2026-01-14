import React from "react";
import InflationProtectionInfo from "../InflationProtectionInfo";
import RegionalRecommendations from "../RegionalRecommendations";
import type { Region } from "@/hooks/use-user-region";

interface ProtectionTabProps {
  userRegion: Region;
  setUserRegion: (region: Region) => void;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
}

export default function ProtectionTab({
  userRegion,
  setUserRegion,
  regionData,
  totalValue,
}: ProtectionTabProps) {
  // Convert regionData to the format needed by our components
  const currentRegions = Object.entries(regionData)
    .filter(([_, data]) => data.value > 0)
    .map(([region]) => region as Region);

  const currentAllocations = Object.fromEntries(
    regionData.map((item) => [item.region, item.value / 100])
  );

  return (
    <div className="space-y-4">
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
