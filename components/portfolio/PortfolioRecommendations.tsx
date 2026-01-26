import React from "react";

// Define region metadata with multichain asset support
const REGION_METADATA = {
  Africa: {
    color: "#F56565", // red-500
    tokens: ["cKES", "cGHS", "eXOF", "cUSD"],
    inflationRate: 11.2,
    volatility: "High",
    growthPotential: "High",
    chains: ["Celo"],
  },
  LatAm: {
    color: "#F6AD55", // orange-400
    tokens: ["cREAL", "cCOP"],
    inflationRate: 5.9,
    volatility: "Medium",
    growthPotential: "Medium",
    chains: ["Celo"],
  },
  Asia: {
    color: "#9F7AEA", // purple-400
    tokens: ["PUSO"],
    inflationRate: 3.9,
    volatility: "Medium",
    growthPotential: "High",
    chains: ["Celo"],
  },
  Europe: {
    color: "#48BB78", // green-500
    tokens: ["cEUR", "EURC"],
    inflationRate: 2.4,
    volatility: "Low",
    growthPotential: "Low",
    chains: ["Celo", "Arc"],
  },
  USA: {
    color: "#4299E1", // blue-500
    tokens: ["cUSD", "USDC"],
    inflationRate: 3.1,
    volatility: "Low",
    growthPotential: "Medium",
    chains: ["Celo", "Arc"],
  },
  Commodities: {
    color: "#D69E2E", // yellow-600
    tokens: ["PAXG"],
    inflationRate: -1.2, // Commodities often outpace inflation
    volatility: "Medium",
    growthPotential: "Medium",
    chains: ["Arbitrum"],
  },
};

// Portfolio allocation strategies with multichain asset classes
const PORTFOLIO_STRATEGIES = {
  conservative: {
    name: "Conservative",
    description: "Focus on stability with minimal commodity exposure",
    allocations: {
      USA: 0.35,
      Europe: 0.25,
      Asia: 0.1,
      LatAm: 0.1,
      Africa: 0.1,
      Commodities: 0.1, // Small gold allocation for stability
    },
    benefits: [
      "Minimal volatility with stable regional currencies",
      "Small gold allocation for inflation protection",
      "Focus on developed market stablecoins",
      "Cross-chain diversification across Celo, Arc, and Arbitrum"
    ]
  },
  balanced: {
    name: "Balanced",
    description: "Mix of regional stability and commodity protection",
    allocations: {
      USA: 0.25,
      Europe: 0.2,
      Asia: 0.15,
      LatAm: 0.15,
      Africa: 0.1,
      Commodities: 0.15, // Moderate commodity exposure
    },
    benefits: [
      "Balanced exposure across regions and asset classes",
      "Meaningful commodity allocation for inflation hedge",
      "Diversified across multiple blockchain networks",
      "Optimal risk-adjusted returns"
    ]
  },
  growth: {
    name: "Growth",
    description: "Higher exposure to emerging markets with commodity backing",
    allocations: {
      USA: 0.2,
      Europe: 0.15,
      Asia: 0.2,
      LatAm: 0.2,
      Africa: 0.15,
      Commodities: 0.1, // Moderate commodity for stability
    },
    benefits: [
      "Higher exposure to high-growth emerging markets",
      "Commodity backing provides stability anchor",
      "Leverages multichain ecosystem for maximum opportunities",
      "Balanced growth with inflation protection"
    ]
  },
  inflationHedge: {
    name: "Inflation Hedge",
    description: "Optimized for inflation protection with significant commodity exposure",
    allocations: {
      USA: 0.2,
      Europe: 0.2,
      Asia: 0.15,
      LatAm: 0.15,
      Africa: 0.1,
      Commodities: 0.2, // Significant commodity allocation
    },
    benefits: [
      "Maximum inflation protection through commodity exposure",
      "Gold allocation hedges against currency debasement",
      "Regional diversification reduces single-currency risk",
      "Multichain strategy leverages best assets on each network"
    ]
  },
};

// Calculate potential allocation adjustments based on current portfolio and target allocation
const calculatePotentialAdjustments = (
  currentAllocations: Record<string, number>,
  targetStrategy: keyof typeof PORTFOLIO_STRATEGIES
) => {
  const targetAllocations = PORTFOLIO_STRATEGIES[targetStrategy].allocations;
  const swaps: Array<{ from: string; to: string; percentage: number }> = [];

  // Find regions that are overallocated
  const overallocated = Object.entries(currentAllocations)
    .filter(([region, allocation]) => {
      const targetAllocation =
        targetAllocations[region as keyof typeof targetAllocations] || 0;
      return allocation > targetAllocation;
    })
    .sort(
      (a, b) =>
        b[1] -
        targetAllocations[b[0] as keyof typeof targetAllocations] -
        (a[1] - targetAllocations[a[0] as keyof typeof targetAllocations])
    );

  // Find regions that are underallocated
  const underallocated = Object.entries(targetAllocations)
    .filter(([region, targetAllocation]) => {
      const currentAllocation = currentAllocations[region] || 0;
      return currentAllocation < targetAllocation;
    })
    .sort(
      (a, b) =>
        b[1] -
        (currentAllocations[b[0]] || 0) -
        (a[1] - (currentAllocations[a[0]] || 0))
    );

  // Create potential adjustment suggestions
  let overIdx = 0;
  let underIdx = 0;

  while (overIdx < overallocated.length && underIdx < underallocated.length) {
    const [overRegion, overAmount] = overallocated[overIdx];
    const [underRegion, underTarget] = underallocated[underIdx];

    const currentUnderAmount = currentAllocations[underRegion] || 0;
    const neededAmount = underTarget - currentUnderAmount;
    const availableAmount =
      overAmount -
      targetAllocations[overRegion as keyof typeof targetAllocations];

    const swapAmount = Math.min(neededAmount, availableAmount);

    if (swapAmount > 0.05) {
      // Only suggest swaps that are significant (>5%)
      swaps.push({
        from: overRegion,
        to: underRegion,
        percentage: Math.round(swapAmount * 100),
      });
    }

    // Update the allocation amounts for next iteration
    overallocated[overIdx][1] -= swapAmount;
    if (
      overallocated[overIdx][1] <=
      targetAllocations[overRegion as keyof typeof targetAllocations] + 0.01
    ) {
      overIdx++;
    }

    const updatedUnderAmount = currentUnderAmount + swapAmount;
    if (updatedUnderAmount >= underTarget - 0.01) {
      underIdx++;
    }
  }

  return swaps;
};

interface PortfolioRecommendationsProps {
  currentAllocations: Record<string, number>;
  onSelectStrategy?: (strategy: keyof typeof PORTFOLIO_STRATEGIES) => void;
}

export default function PortfolioRecommendations({
  currentAllocations,
  onSelectStrategy,
}: PortfolioRecommendationsProps) {
  const [selectedStrategy, setSelectedStrategy] =
    React.useState<keyof typeof PORTFOLIO_STRATEGIES>("balanced");

  // Calculate potential adjustments
  const potentialAdjustments = calculatePotentialAdjustments(
    currentAllocations,
    selectedStrategy
  );

  // Handle strategy selection
  const handleStrategyChange = (
    strategy: keyof typeof PORTFOLIO_STRATEGIES
  ) => {
    setSelectedStrategy(strategy);
    if (onSelectStrategy) {
      onSelectStrategy(strategy);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 border border-gray-200">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-bold text-gray-900">
          Portfolio Strategies
        </h2>
        <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
          Analysis: World Bank, Alpha Vantage
        </span>
      </div>

      <div className="mb-4">
        <p className="text-gray-800 mb-4 font-medium">
          Explore different portfolio strategies and see how they compare to
          your current allocation.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {Object.entries(PORTFOLIO_STRATEGIES).map(([key, strategy]) => (
            <button
              key={key}
              onClick={() =>
                handleStrategyChange(key as keyof typeof PORTFOLIO_STRATEGIES)
              }
              className={`p-2 text-sm rounded-md transition-colors shadow-sm ${selectedStrategy === key
                ? "bg-blue-600 border-blue-700 border text-white font-medium"
                : "bg-gray-50 border border-gray-200 text-gray-800 hover:bg-gray-100"
                }`}
            >
              <div className="font-medium">{strategy.name}</div>
              <div className="text-xs mt-1">{strategy.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="font-bold text-gray-900 mb-2">Strategy Allocation</h3>
        <div className="bg-white p-3 rounded-md border border-gray-200 shadow-sm">
          <div className="flex mb-2">
            {Object.entries(
              PORTFOLIO_STRATEGIES[selectedStrategy].allocations
            ).map(([region, allocation]) => (
              <div
                key={region}
                className="h-6"
                style={{
                  width: `${allocation * 100}%`,
                  backgroundColor:
                    REGION_METADATA[region as keyof typeof REGION_METADATA]
                      ?.color || "#CBD5E0",
                }}
                title={`${region}: ${(allocation * 100).toFixed(0)}%`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1 text-xs">
            {Object.entries(
              PORTFOLIO_STRATEGIES[selectedStrategy].allocations
            ).map(([region, allocation]) => (
              <div key={region} className="flex items-center">
                <div
                  className="size-4 rounded-full mr-1 border border-gray-200"
                  style={{
                    backgroundColor:
                      REGION_METADATA[region as keyof typeof REGION_METADATA]
                        ?.color || "#CBD5E0",
                  }}
                />
                <span className="font-medium text-gray-900">
                  {region}: {(allocation * 100).toFixed(0)}%
                </span>
                {region === "Commodities" && (
                  <span className="ml-1 text-xs text-gray-500">(Arbitrum)</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Multichain Asset Breakdown */}
        <div className="mt-3 p-3 bg-blue-50 rounded-md border border-blue-200">
          <h4 className="font-medium text-blue-800 mb-2">Multichain Asset Distribution</h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">🌐 Celo Network:</span>
              <span className="font-medium text-blue-800">
                {(
                  (PORTFOLIO_STRATEGIES[selectedStrategy].allocations.Africa || 0) +
                  (PORTFOLIO_STRATEGIES[selectedStrategy].allocations.LatAm || 0) +
                  (PORTFOLIO_STRATEGIES[selectedStrategy].allocations.Asia || 0)
                ).toFixed(0)}% (Regional Stablecoins)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">⚡ Arc Network:</span>
              <span className="font-medium text-blue-800">
                {(
                  (PORTFOLIO_STRATEGIES[selectedStrategy].allocations.USA || 0) +
                  (PORTFOLIO_STRATEGIES[selectedStrategy].allocations.Europe || 0)
                ).toFixed(0)}% (USDC, EURC)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">🔷 Arbitrum:</span>
              <span className="font-medium text-blue-800">
                {((PORTFOLIO_STRATEGIES[selectedStrategy].allocations.Commodities || 0) * 100).toFixed(0)}% (PAXG Gold)
              </span>
            </div>
          </div>
        </div>
      </div>

      {potentialAdjustments.length > 0 ? (
        <div className="mb-4">
          <h3 className="font-bold text-gray-900 mb-2">
            Potential Adjustments
          </h3>
          <div className="space-y-2">
            {potentialAdjustments.map((swap, index) => (
              <div
                key={index}
                className="bg-white p-3 rounded-md border border-blue-200 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div
                      className="size-4 rounded-full mr-1 border border-gray-200"
                      style={{
                        backgroundColor:
                          REGION_METADATA[
                            swap.from as keyof typeof REGION_METADATA
                          ]?.color || "#CBD5E0",
                      }}
                    />
                    <span className="font-medium text-gray-900">
                      {swap.from}
                    </span>
                  </div>
                  <div className="mx-2 text-gray-800 font-bold">→</div>
                  <div className="flex items-center">
                    <div
                      className="size-4 rounded-full mr-1 border border-gray-200"
                      style={{
                        backgroundColor:
                          REGION_METADATA[
                            swap.to as keyof typeof REGION_METADATA
                          ]?.color || "#CBD5E0",
                      }}
                    />
                    <span className="font-medium text-gray-900">{swap.to}</span>
                  </div>
                  <div className="ml-auto font-bold text-blue-600">
                    {swap.percentage}%
                  </div>
                </div>
                <div className="text-sm text-gray-800 mt-2 font-medium">
                  Moving {swap.percentage}% from {swap.from} to {swap.to} would
                  align with the {PORTFOLIO_STRATEGIES[selectedStrategy].name}{" "}
                  strategy.
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-green-50 p-3 rounded-md mb-4 border border-green-200 shadow-sm">
          <p className="text-sm text-green-800 font-medium">
            Your current portfolio is already similar to the{" "}
            <span className="font-bold">
              {PORTFOLIO_STRATEGIES[selectedStrategy].name}
            </span>{" "}
            strategy.
          </p>
        </div>
      )}

      <div className="bg-blue-50 p-4 rounded-md border border-blue-200 shadow-sm">
        <h3 className="font-bold text-gray-900 mb-2">Strategy Benefits</h3>
        <ul className="text-sm text-gray-800 list-disc pl-5 space-y-2">
          {PORTFOLIO_STRATEGIES[selectedStrategy].benefits.map((benefit, index) => (
            <li key={index} className="font-medium">{benefit}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
