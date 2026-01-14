import React, { useState } from "react";
import CurrencyPerformanceChart from "../CurrencyPerformanceChart";
import RegionalIconography from "../RegionalIconography";
import type { Region } from "@/hooks/use-user-region";
import { useInflationData } from "@/hooks/use-inflation-data";
import InflationVisualizer from "../InflationVisualizer";
import { REGION_COLORS } from "@/constants/regions";

interface AnalyticsTabProps {
  performanceData: {
    dates: string[];
    values: number[];
    regions: Record<Region, number[]>;
    percentChange: number;
    volatility: number;
  };
  isPerformanceLoading: boolean;
  currencyPerformanceData: any;
  isCurrencyPerformanceLoading: boolean;
  regionData: Array<{ region: string; value: number; color: string }>;
  totalValue: number;
  userRegion: string;
  setUserRegion?: (region: Region) => void;
}

// Emerging markets growth data (for empty state and positive visualization)
const EMERGING_MARKETS_DATA = {
  Africa: {
    icon: "🌍",
    growthRate: 4.2,
    population: "1.4 billion",
    youthPercentage: 60,
    digitalAdoption: 42,
    highlight: "Fastest growing mobile money market globally",
  },
  LatAm: {
    icon: "🌴",
    growthRate: 3.1,
    population: "660 million",
    youthPercentage: 40,
    digitalAdoption: 68,
    highlight: "Leading region in fintech adoption",
  },
  Asia: {
    icon: "🏮",
    growthRate: 5.3,
    population: "4.7 billion",
    youthPercentage: 45,
    digitalAdoption: 64,
    highlight: "Home to 60% of global digital payments",
  },
};

export default function AnalyticsTab({
  performanceData,
  isPerformanceLoading,
  currencyPerformanceData,
  isCurrencyPerformanceLoading,
  regionData,
  totalValue,
  userRegion,
  setUserRegion,
}: AnalyticsTabProps) {
  // Use local state for selected region if no setter is provided
  const [localRegion, setLocalRegion] = useState<Region>(userRegion as Region);

  // Use either the prop setter or local state
  const selectedRegion = setUserRegion ? (userRegion as Region) : localRegion;
  const changeRegion = (region: Region) => {
    if (setUserRegion) {
      setUserRegion(region);
    } else {
      setLocalRegion(region);
    }
  };

  // Get inflation data for region selection
  const { inflationData } = useInflationData();

  // Get inflation rate for the selected region
  const selectedRegionInflationRate =
    inflationData[selectedRegion]?.avgRate || 0;

  // Check if user has any stablecoins
  const hasStablecoins = totalValue > 0;

  // Get emerging market data for the selected region
  const emergingMarketData =
    EMERGING_MARKETS_DATA[
      selectedRegion as keyof typeof EMERGING_MARKETS_DATA
    ] || EMERGING_MARKETS_DATA.Africa;

  // Log regional data for debugging
  console.log("Regional data:", regionData);

  return (
    <div className="space-y-4">
      {/* Title with regional iconography */}
      <div className="relative overflow-hidden bg-white rounded-lg shadow-md p-5 mb-4 border border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <RegionalIconography
              region={selectedRegion}
              size="sm"
              className="mr-2"
            />
            <h2 className="text-lg font-bold text-gray-900">
              Inflation Analytics
            </h2>
          </div>
          <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium shadow-sm border border-blue-200">
            5-Year View
          </span>
        </div>
        <p className="text-sm text-gray-700 mb-4 font-medium">
          Track stablecoin performance across regions
        </p>

        {/* Region selector */}
        <div className="grid grid-cols-5 gap-2 mt-4">
          {Object.keys(inflationData).map((region) => (
            <button
              key={region}
              className={`p-3 text-xs rounded-md transition-colors flex flex-col items-center shadow-sm ${
                region === selectedRegion
                  ? `bg-region-${region.toLowerCase()}-light border-2 border-region-${region.toLowerCase()}-medium text-region-${region.toLowerCase()}-dark font-bold`
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => changeRegion(region as Region)}
            >
              <RegionalIconography
                region={region as Region}
                size="sm"
                className="mb-2"
              />
              <span className="font-medium">{region}</span>
            </button>
          ))}
        </div>
      </div>

      {!hasStablecoins ? (
        /* Empty state with emerging markets growth data */
        <div className="relative overflow-hidden bg-white rounded-lg shadow-md p-6 mb-4 text-center border border-gray-200">
          <div className="relative">
            <div className="flex justify-center mb-6">
              <div
                className="size-24 rounded-full flex items-center justify-center shadow-md"
                style={{
                  backgroundColor:
                    REGION_COLORS[selectedRegion as keyof typeof REGION_COLORS],
                }}
              >
                <span
                  className="text-4xl text-white"
                  role="img"
                  aria-label="Region icon"
                >
                  {emergingMarketData.icon}
                </span>
              </div>
            </div>
            <div
              className="bg-white p-5 rounded-lg mb-6 border-2 shadow-md"
              style={{
                borderColor:
                  REGION_COLORS[selectedRegion as keyof typeof REGION_COLORS],
              }}
            >
              <h4 className="font-bold text-gray-900 mb-3 text-lg">
                {selectedRegion} Market Highlights
              </h4>
              <div className="grid grid-cols-2 gap-4 text-left mb-4">
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-700 font-medium mb-1">
                    Growth Rate
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    +{emergingMarketData.growthRate}%
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-700 font-medium mb-1">
                    Population
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {emergingMarketData.population}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-700 font-medium mb-1">
                    Youth
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {emergingMarketData.youthPercentage}%
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200 shadow-sm">
                  <div className="text-sm text-gray-700 font-medium mb-1">
                    Digital Adoption
                  </div>
                  <div className="text-lg font-bold text-gray-900">
                    {emergingMarketData.digitalAdoption}%
                  </div>
                </div>
              </div>
              <div
                className="text-sm font-bold p-3 rounded-md shadow-sm text-white"
                style={{
                  backgroundColor:
                    REGION_COLORS[selectedRegion as keyof typeof REGION_COLORS],
                }}
              >
                {emergingMarketData.highlight}
              </div>
            </div>

            {/* Inflation Visualizer in empty state */}
            <div className="mb-6">
              <InflationVisualizer
                region={selectedRegion}
                inflationRate={selectedRegionInflationRate}
                years={5}
                initialAmount={100}
              />
            </div>

            <button
              onClick={() => (window.location.href = "#swap")}
              className={`bg-region-${selectedRegion.toLowerCase()}-medium hover:bg-region-${selectedRegion.toLowerCase()}-dark text-white px-4 py-3 rounded-md transition-colors w-full font-medium`}
            >
              Get Started with Stablecoins
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Inflation Visualizer - shows how money loses value over time */}
          <InflationVisualizer
            region={selectedRegion}
            inflationRate={selectedRegionInflationRate}
            years={5}
            initialAmount={100}
          />

          {/* Currency Performance Chart with better contrast */}
          {isCurrencyPerformanceLoading ? (
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex items-center justify-center h-48">
              <div className="flex items-center text-gray-700">
                <svg
                  className="animate-spin -ml-1 mr-3 size-5 text-blue-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Loading currency data...
              </div>
            </div>
          ) : (
            <CurrencyPerformanceChart
              data={currencyPerformanceData}
              title="Value of $1 over 30 days"
            />
          )}
        </>
      )}
    </div>
  );
}
