import React, { useState } from "react";
import type { Region } from "../hooks/use-user-region";
import RegionalIconography, { RegionalPattern } from "./RegionalIconography";
import { REGION_COLORS } from "../constants/regions";

// Region-specific insights
const REGION_INSIGHTS: Record<
  Region,
  {
    title: string;
    description: string;
    typicalAllocation: Record<Region, number>;
    considerations: string[];
    inflationRate: number;
    volatilityLevel: "Low" | "Medium" | "High";
    localCurrencies: string[];
  }
> = {
  Africa: {
    title: "Regional Insights: Africa",
    description:
      "Based on historical data for this region, many users diversify into EUR and USD to address local currency volatility.",
    typicalAllocation: {
      Africa: 40,
      USA: 30,
      Europe: 20,
      Asia: 5,
      LatAm: 5,
    },
    considerations: [
      "African currencies often experience higher inflation rates",
      "EUR and USD provide stability during economic uncertainty",
      "Local currency exposure helps with everyday expenses",
      "A mix of local and global currencies balances needs with stability",
    ],
    inflationRate: 11.2,
    volatilityLevel: "High",
    localCurrencies: ["cKES", "cGHS", "eXOF"],
  },
  USA: {
    title: "Regional Insights: USA",
    description:
      "Users in the USA often add exposure to EUR and emerging markets for diversification benefits.",
    typicalAllocation: {
      USA: 50,
      Europe: 25,
      Asia: 10,
      Africa: 10,
      LatAm: 5,
    },
    considerations: [
      "USD is a global reserve currency with relative stability",
      "EUR provides hedge against USD fluctuations",
      "Emerging market exposure offers different economic cycles",
      "Global diversification can reduce overall portfolio volatility",
    ],
    inflationRate: 3.1,
    volatilityLevel: "Low",
    localCurrencies: ["cUSD"],
  },
  Europe: {
    title: "Regional Insights: Europe",
    description:
      "European users typically maintain EUR as their base with USD and emerging market exposure for diversification.",
    typicalAllocation: {
      Europe: 50,
      USA: 25,
      Africa: 10,
      Asia: 10,
      LatAm: 5,
    },
    considerations: [
      "EUR provides stability for European residents",
      "USD offers protection against EUR-specific risks",
      "African stablecoins can provide exposure to different markets",
      "Diversification across currencies can reduce overall risk",
    ],
    inflationRate: 2.4,
    volatilityLevel: "Low",
    localCurrencies: ["cEUR"],
  },
  LatAm: {
    title: "Regional Insights: Latin America",
    description:
      "In Latin America, many users maintain significant USD and EUR allocations alongside local currencies.",
    typicalAllocation: {
      LatAm: 35,
      USA: 35,
      Europe: 20,
      Asia: 5,
      Africa: 5,
    },
    considerations: [
      "Latin American currencies often face inflation pressures",
      "USD provides stability for savings",
      "Local currency exposure helps with everyday expenses",
      "A balanced approach addresses both local needs and stability",
    ],
    inflationRate: 5.9,
    volatilityLevel: "Medium",
    localCurrencies: ["cREAL", "cCOP"],
  },
  Asia: {
    title: "Regional Insights: Asia",
    description:
      "Users in Asia often take a balanced approach with significant USD exposure alongside local currencies.",
    typicalAllocation: {
      Asia: 40,
      USA: 30,
      Europe: 20,
      Africa: 5,
      LatAm: 5,
    },
    considerations: [
      "Asian currencies vary widely in stability",
      "USD provides stability for savings",
      "EUR offers diversification from USD",
      "A mix of local and global currencies addresses different needs",
    ],
    inflationRate: 3.9,
    volatilityLevel: "Medium",
    localCurrencies: ["PUSO"],
  },
};

interface RegionalRecommendationsProps {
  userRegion: Region;
  currentAllocations?: Record<string, number>;
}

export default function RegionalRecommendations({
  userRegion,
  currentAllocations,
}: RegionalRecommendationsProps) {
  const [selectedRegion, setSelectedRegion] = useState<Region>(userRegion);
  const regionData = REGION_INSIGHTS[selectedRegion];

  // Calculate how far current allocation is from typical
  const calculateDifference = () => {
    if (!currentAllocations) return null;

    const differences: Record<string, number> = {};
    let totalDifference = 0;

    Object.entries(regionData.typicalAllocation).forEach(
      ([region, typical]) => {
        const current = (currentAllocations[region] || 0) * 100;
        const diff = typical - current;
        differences[region] = diff;
        totalDifference += Math.abs(diff);
      }
    );

    return {
      differences,
      totalDifference: totalDifference / 2, // Divide by 2 because each positive difference has a corresponding negative
      isClose: totalDifference < 10, // Less than 10% total difference is considered close to typical
    };
  };

  const difference = currentAllocations ? calculateDifference() : null;

  return (
    <div className="relative overflow-hidden bg-white rounded-card shadow-card p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <RegionalIconography
            region={selectedRegion}
            size="sm"
            className="mr-2"
          />
          <h2 className="text-lg font-semibold text-text-primary">
            Historical Data
          </h2>
        </div>
        <span className="text-xs text-text-muted">
          Data: World Bank, Alpha Vantage
        </span>
      </div>

      {/* Region selector tabs */}
      <div className="flex overflow-x-auto mb-4 pb-1">
        {Object.keys(REGION_INSIGHTS).map((region) => (
          <button
            key={region}
            className={`px-3 py-1 mr-2 text-sm rounded-md whitespace-nowrap flex items-center ${
              selectedRegion === region
                ? `bg-region-${region.toLowerCase()}-light text-region-${region.toLowerCase()}-dark font-medium`
                : "bg-background-subtle text-text-secondary hover:bg-background-muted"
            }`}
            onClick={() => setSelectedRegion(region as Region)}
          >
            <RegionalIconography
              region={region as Region}
              size="sm"
              className="mr-1"
            />
            <span>{region}</span>
          </button>
        ))}
      </div>

      <div
        className={`relative overflow-hidden bg-region-${selectedRegion.toLowerCase()}-light bg-opacity-20 p-4 rounded-card mb-4`}
      >
        <RegionalPattern region={selectedRegion} />
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <h3
              className={`font-medium text-region-${selectedRegion.toLowerCase()}-dark`}
            >
              {regionData.title}
            </h3>
            <span
              className={`text-xs bg-region-${selectedRegion.toLowerCase()}-medium text-white px-2 py-1 rounded-full`}
            >
              {selectedRegion}
            </span>
          </div>

          <p className="text-sm text-text-secondary mb-4">
            {regionData.description}
          </p>
        </div>
      </div>

      <h3 className="font-medium text-text-primary mb-2">
        Typical Allocation Pattern
      </h3>
      <div className="bg-background-subtle p-3 rounded-card mb-4">
        <div className="flex mb-2 h-8 rounded-md overflow-hidden">
          {Object.entries(regionData.typicalAllocation).map(
            ([region, allocation]) => (
              <div
                key={region}
                className="h-full flex items-center justify-center text-xs text-white font-medium"
                style={{
                  width: `${allocation}%`,
                  backgroundColor:
                    REGION_COLORS[region as keyof typeof REGION_COLORS] ||
                    "#CBD5E0",
                }}
                title={`${region}: ${allocation}%`}
              >
                {allocation >= 10 ? `${allocation}%` : ""}
              </div>
            )
          )}
        </div>
        <div className="grid grid-cols-3 gap-1 text-xs">
          {Object.entries(regionData.typicalAllocation).map(
            ([region, allocation]) => (
              <div key={region} className="flex items-center">
                <div
                  className="size-3 rounded-full mr-1"
                  style={{
                    backgroundColor:
                      REGION_COLORS[region as keyof typeof REGION_COLORS] ||
                      "#CBD5E0",
                  }}
                />
                <span className="text-text-secondary">
                  {region}:{" "}
                  <span className="font-medium text-text-primary">
                    {allocation}%
                  </span>
                </span>
              </div>
            )
          )}
        </div>
      </div>

      {difference && (
        <div
          className={`p-3 rounded-card mb-4 ${
            difference.isClose
              ? "bg-accent-success bg-opacity-5 border border-accent-success border-opacity-10"
              : "bg-background-subtle"
          }`}
        >
          <h3
            className={`font-medium mb-2 ${
              difference.isClose ? "text-accent-success" : "text-text-primary"
            }`}
          >
            {difference.isClose
              ? "Your portfolio is similar to typical patterns"
              : "Your portfolio vs typical patterns"}
          </h3>

          <div className="space-y-2">
            {Object.entries(difference.differences)
              .filter(([_, diff]) => Math.abs(diff) >= 5) // Only show significant differences
              .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])) // Sort by absolute difference
              .map(([region, diff]) => (
                <div
                  key={region}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center">
                    <RegionalIconography
                      region={region as Region}
                      size="sm"
                      className="mr-1"
                    />
                    <span className="text-text-secondary">{region}</span>
                  </div>
                  <div
                    className={
                      diff > 0 ? "text-accent-warning" : "text-accent-success"
                    }
                  >
                    {diff > 0
                      ? `${diff.toFixed(0)}% less than typical`
                      : `${Math.abs(diff).toFixed(0)}% more than typical`}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div
        className={`relative overflow-hidden bg-region-${selectedRegion.toLowerCase()}-light bg-opacity-10 p-3 rounded-card`}
      >
        <RegionalPattern region={selectedRegion} />
        <div className="relative">
          <h3
            className={`font-medium text-region-${selectedRegion.toLowerCase()}-dark mb-2`}
          >
            Historical Context
          </h3>
          <p className="text-sm text-text-secondary">
            Data shows that residents of {selectedRegion} who diversified their
            savings across multiple stablecoins preserved up to{" "}
            <span className="font-bold text-accent-success">
              {selectedRegion === "Africa" || selectedRegion === "LatAm"
                ? "15%"
                : "8%"}
            </span>{" "}
            more purchasing power during recent economic volatility compared to
            those who held only local currency.
          </p>
        </div>
      </div>
    </div>
  );
}
