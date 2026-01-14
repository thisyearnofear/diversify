import React, { useState } from "react";
import { useInflationData } from "../hooks/use-inflation-data";
import type { Region } from "../hooks/use-user-region";
import RegionalIconography, { RegionalPattern } from "./RegionalIconography";
import RealLifeScenario from "./RealLifeScenario";

// Calculate potential savings from diversification
const calculateSavings = (
  amount: number,
  homeRegion: Region,
  diversifiedRegions: Array<Region>,
  inflationData: any
): number => {
  if (!diversifiedRegions.length) return 0;

  const homeInflation = inflationData[homeRegion]?.avgRate || 0;

  // Calculate average inflation rate of diversified portfolio
  const totalInflation = diversifiedRegions.reduce((sum, region) => {
    if (inflationData[region]) {
      return sum + inflationData[region].avgRate;
    }
    return sum + homeInflation;
  }, 0);

  const avgDiversifiedInflation = totalInflation / diversifiedRegions.length;

  // If diversified inflation is higher than home, return 0 (no savings)
  if (avgDiversifiedInflation >= homeInflation) return 0;

  // Calculate savings as the difference in purchasing power after 1 year
  const homeValueAfterYear = amount * (1 - homeInflation / 100);
  const diversifiedValueAfterYear =
    amount * (1 - avgDiversifiedInflation / 100);

  return diversifiedValueAfterYear - homeValueAfterYear;
};

// Get a real-world example of what the savings could buy
const getSavingsExample = (savings: number, region: Region): string => {
  if (savings <= 0) return "";

  switch (region) {
    case "Africa":
      if (savings < 10) return "a few days of mobile data";
      if (savings < 50) return "a week of groceries for a small family";
      if (savings < 100) return "school supplies for a child";
      if (savings < 500) return "a month of rent in some areas";
      return "several months of living expenses";

    case "USA":
      if (savings < 10) return "a few coffee shop visits";
      if (savings < 50) return "a tank of gas";
      if (savings < 100) return "a week of groceries";
      if (savings < 500) return "a month of utility bills";
      return "a month of rent in some areas";

    case "Europe":
      if (savings < 10) return "a few public transport tickets";
      if (savings < 50) return "a nice meal out";
      if (savings < 100) return "a week of groceries";
      if (savings < 500) return "a weekend getaway";
      return "a month of expenses in some areas";

    case "LatAm":
      if (savings < 10) return "a week of public transport";
      if (savings < 50) return "a week of groceries for a small family";
      if (savings < 100) return "a month of mobile and internet service";
      if (savings < 500) return "a month of rent in some areas";
      return "several months of living expenses";

    case "Asia":
      if (savings < 10) return "several street food meals";
      if (savings < 50) return "a week of groceries";
      if (savings < 100) return "a month of utility bills";
      if (savings < 500) return "a month of rent in some areas";
      return "several months of living expenses";

    default:
      if (savings < 10) return "a few small items";
      if (savings < 50) return "a week of small expenses";
      if (savings < 100) return "a significant purchase";
      if (savings < 500) return "a major monthly expense";
      return "a large portion of monthly living costs";
  }
};

interface InflationProtectionInfoProps {
  homeRegion?: Region;
  currentRegions?: Array<Region>;
  amount?: number;
  onChangeHomeRegion?: (region: Region) => void;
}

export default function InflationProtectionInfo({
  homeRegion = "Africa",
  currentRegions = [],
  amount = 1000,
  onChangeHomeRegion,
}: InflationProtectionInfoProps) {
  // Use our custom hook to get real inflation data
  const { inflationData, dataSource } = useInflationData();
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [activeScenario, setActiveScenario] = useState<
    "education" | "remittance" | "business" | "travel" | "savings"
  >("savings");

  // Calculate potential savings
  const savings = calculateSavings(
    amount,
    homeRegion,
    currentRegions,
    inflationData
  );

  // Get home region inflation rate
  const homeInflationRate = inflationData[homeRegion]?.avgRate || 0;

  // Calculate average inflation rate of current portfolio
  const avgPortfolioInflation = currentRegions.length
    ? currentRegions.reduce((sum, region) => {
        if (inflationData[region]) {
          return sum + inflationData[region].avgRate;
        }
        return sum + homeInflationRate;
      }, 0) / currentRegions.length
    : homeInflationRate;

  // Get region-specific insights
  const getRegionInsights = (region: Region) => {
    const data = inflationData[region];
    if (!data) return null;

    return {
      inflationRate: data.avgRate,
      stablecoins: data.stablecoins,
      comparisonToHome: data.avgRate - homeInflationRate,
    };
  };

  // Get insights for selected region or home region
  const regionInsights = selectedRegion
    ? getRegionInsights(selectedRegion)
    : getRegionInsights(homeRegion);

  // Handle changing home region
  const handleChangeHomeRegion = (region: Region) => {
    if (onChangeHomeRegion) {
      onChangeHomeRegion(region);
    }
  };

  // Get savings example
  const savingsExample = getSavingsExample(savings, homeRegion);

  return (
    <div className="relative overflow-hidden bg-white rounded-card shadow-card p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <RegionalIconography region={homeRegion} size="sm" className="mr-2" />
          <h2 className="text-lg font-semibold text-text-primary">
            Protect Your Money
          </h2>
        </div>
        <div className="flex items-center">
          {dataSource === "api" && (
            <span className="text-xs bg-accent-success bg-opacity-10 text-accent-success px-2 py-1 rounded-full">
              Live Data
            </span>
          )}
          {dataSource === "cache" && (
            <span className="text-xs bg-accent-info bg-opacity-10 text-accent-info px-2 py-1 rounded-full">
              Cached Data
            </span>
          )}
        </div>
      </div>

      {/* Home Region Selector - MOVED TO TOP */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium text-text-primary">Your Location</h3>
          <span className="text-xs text-text-muted">
            Based on World Bank data
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1 mb-3">
          {Object.keys(inflationData).map((region) => (
            <button
              key={region}
              className={`p-2 text-xs rounded-md transition-colors flex flex-col items-center ${
                region === homeRegion
                  ? `bg-region-${region.toLowerCase()}-light border-region-${region.toLowerCase()}-medium border text-region-${region.toLowerCase()}-dark font-medium`
                  : "bg-background-subtle border border-background-muted text-text-secondary hover:bg-background-muted"
              }`}
              onClick={() => onChangeHomeRegion?.(region as Region)}
            >
              <RegionalIconography
                region={region as Region}
                size="sm"
                className="mb-1"
              />
              <span>{region}</span>
            </button>
          ))}
        </div>

        <div
          className={`relative overflow-hidden bg-region-${homeRegion.toLowerCase()}-light p-4 rounded-card`}
        >
          <RegionalPattern region={homeRegion} />
          <div className="relative flex justify-between items-center">
            <div>
              <p
                className={`text-sm text-region-${homeRegion.toLowerCase()}-dark font-medium`}
              >
                {homeRegion} inflation:{" "}
                <span className="font-bold">
                  {homeInflationRate.toFixed(1)}%
                </span>
                <span className="text-xs ml-1">per year</span>
              </p>
              {currentRegions.length > 0 && (
                <p
                  className={`text-xs text-region-${homeRegion.toLowerCase()}-dark mt-1`}
                >
                  Your portfolio:{" "}
                  <span className="font-bold">
                    {avgPortfolioInflation.toFixed(1)}%
                  </span>
                  {avgPortfolioInflation < homeInflationRate && (
                    <span className="ml-1 text-accent-success">
                      ({(homeInflationRate - avgPortfolioInflation).toFixed(1)}%
                      better)
                    </span>
                  )}
                </p>
              )}
            </div>
            {savings > 0 && (
              <div className="text-right">
                <p className="text-xs text-accent-success font-medium">
                  You could save:
                </p>
                <p className="text-sm text-accent-success font-bold">
                  ${savings.toFixed(0)}/year
                </p>
                {savingsExample && (
                  <p className="text-xs text-text-secondary">
                    That's {savingsExample}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Available Stablecoins - MOVED UP */}
      <div className="mb-4">
        <h3 className="font-medium text-text-primary mb-2">
          Available Stablecoins
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(inflationData).map(
            ([region, data]: [string, any]) => (
              <div
                key={region}
                className={`relative overflow-hidden p-3 rounded-card border cursor-pointer transition-colors ${
                  region === homeRegion
                    ? `border-region-${region.toLowerCase()}-medium bg-region-${region.toLowerCase()}-light`
                    : currentRegions.includes(region as Region)
                    ? "border-accent-success bg-accent-success bg-opacity-5"
                    : "border-background-muted hover:border-text-muted"
                } ${
                  selectedRegion === region
                    ? `ring-2 ring-region-${region.toLowerCase()}-medium`
                    : ""
                }`}
                onClick={() => setSelectedRegion(region as Region)}
              >
                <div className="relative flex items-center">
                  <RegionalIconography
                    region={region as Region}
                    size="sm"
                    className="mr-2"
                  />
                  <div>
                    <div className="font-medium text-text-primary">
                      {region}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {data.avgRate.toFixed(1)}% inflation/year
                    </div>
                  </div>
                </div>
                <div className="text-xs text-text-muted mt-2 flex flex-wrap gap-1">
                  {data.stablecoins.map((coin: string) => (
                    <span
                      key={coin}
                      className="inline-block px-1.5 py-0.5 bg-background-subtle rounded"
                    >
                      {coin}
                    </span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Real-life scenario */}
      <div className="mb-4">
        <h3 className="font-medium text-text-primary mb-2">
          How Inflation Affects You
        </h3>
        <div className="text-xs text-text-muted mb-2">
          “Inflation is when you pay fifteen dollars for the ten-dollar haircut
          you used to get for five dollars when you had hair.”
          <br /> ― Sam Ewing
        </div>

        {/* Scenario selector */}
        <div className="flex overflow-x-auto mb-3 pb-1">
          {["savings", "education", "remittance", "business", "travel"].map(
            (scenario) => (
              <button
                key={scenario}
                className={`px-3 py-1 mr-2 text-xs rounded-full whitespace-nowrap ${
                  activeScenario === scenario
                    ? `bg-region-${homeRegion.toLowerCase()}-medium text-white font-medium`
                    : `bg-region-${homeRegion.toLowerCase()}-light text-region-${homeRegion.toLowerCase()}-dark hover:bg-region-${homeRegion.toLowerCase()}-light hover:bg-opacity-70`
                }`}
                onClick={() => setActiveScenario(scenario as any)}
              >
                {scenario.charAt(0).toUpperCase() + scenario.slice(1)}
              </button>
            )
          )}
        </div>

        <RealLifeScenario
          region={homeRegion}
          scenarioType={activeScenario}
          inflationRate={homeInflationRate}
          amount={amount}
        />
      </div>

      {/* Region Insights */}
      {selectedRegion && regionInsights && (
        <div
          className={`relative overflow-hidden bg-region-${selectedRegion.toLowerCase()}-light bg-opacity-30 p-4 rounded-card mb-4`}
        >
          <RegionalPattern region={selectedRegion} />
          <div className="relative">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center">
                <RegionalIconography
                  region={selectedRegion}
                  size="sm"
                  className="mr-2"
                />
                <h3
                  className={`font-medium text-region-${selectedRegion.toLowerCase()}-dark`}
                >
                  {selectedRegion} Details
                </h3>
              </div>
              <button
                className={`text-xs text-region-${selectedRegion.toLowerCase()}-dark hover:text-region-${selectedRegion.toLowerCase()}-contrast px-2 py-1 rounded-full bg-white bg-opacity-50`}
                onClick={() => setSelectedRegion(null)}
              >
                Close
              </button>
            </div>
            <div className="text-sm space-y-3 bg-white bg-opacity-70 p-3 rounded-md">
              <p className="flex justify-between">
                <span className="text-text-secondary">Inflation rate:</span>
                <span className="font-medium text-text-primary">
                  {regionInsights.inflationRate.toFixed(1)}%
                  {regionInsights.comparisonToHome < 0 && (
                    <span className="text-accent-success ml-1">
                      ({Math.abs(regionInsights.comparisonToHome).toFixed(1)}%
                      lower)
                    </span>
                  )}
                  {regionInsights.comparisonToHome > 0 && (
                    <span className="text-accent-error ml-1">
                      ({regionInsights.comparisonToHome.toFixed(1)}% higher)
                    </span>
                  )}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-text-secondary">Available coins:</span>
                <span className="font-medium text-text-primary">
                  {regionInsights.stablecoins.join(", ")}
                </span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center text-xs text-text-muted mt-3">
        <span>Data: World Bank, Alpha Vantage</span>
        <span>Updated daily</span>
      </div>
    </div>
  );
}
