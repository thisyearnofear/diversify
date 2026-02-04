import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";


// Define region metadata with multichain asset support
const REGION_METADATA = {
  Africa: {
    color: "#F56565",
    gradient: "from-red-500 via-red-600 to-rose-600",
    icon: "🌍",
    tokens: ["cKES", "cGHS", "eXOF", "cUSD"],
    inflationRate: 11.2,
    volatility: "High",
    growthPotential: "High",
    chains: ["Celo"],
  },
  LatAm: {
    color: "#F6AD55",
    gradient: "from-orange-500 via-orange-600 to-amber-600",
    icon: "🌎",
    tokens: ["cREAL", "cCOP"],
    inflationRate: 5.9,
    volatility: "Medium",
    growthPotential: "Medium",
    chains: ["Celo"],
  },
  Asia: {
    color: "#9F7AEA",
    gradient: "from-violet-500 via-purple-600 to-indigo-600",
    icon: "🌏",
    tokens: ["PUSO"],
    inflationRate: 3.9,
    volatility: "Medium",
    growthPotential: "High",
    chains: ["Celo"],
  },
  Europe: {
    color: "#48BB78",
    gradient: "from-emerald-500 via-emerald-600 to-teal-600",
    icon: "🇪🇺",
    tokens: ["cEUR", "EURC"],
    inflationRate: 2.4,
    volatility: "Low",
    growthPotential: "Low",
    chains: ["Celo", "Arc"],
  },
  USA: {
    color: "#4299E1",
    gradient: "from-blue-500 via-blue-600 to-indigo-600",
    icon: "🇺🇸",
    tokens: ["cUSD", "USDC"],
    inflationRate: 3.1,
    volatility: "Low",
    growthPotential: "Medium",
    chains: ["Celo", "Arc"],
  },
  Commodities: {
    color: "#D69E2E",
    gradient: "from-amber-500 via-orange-500 to-orange-600",
    icon: "🥇",
    tokens: ["PAXG"],
    inflationRate: -1.2,
    volatility: "Medium",
    growthPotential: "Medium",
    chains: ["Arbitrum"],
  },
};

// Portfolio allocation strategies with enhanced metadata
const PORTFOLIO_STRATEGIES = {
  conservative: {
    name: "Conservative",
    description: "Focus on stability with minimal commodity exposure",
    riskLevel: "LOW" as const,
    icon: "🛡️",
    color: "from-green-500 to-emerald-600",
    allocations: {
      USA: 0.35,
      Europe: 0.25,
      Asia: 0.1,
      LatAm: 0.1,
      Africa: 0.1,
      Commodities: 0.1,
    },
    benefits: [
      "Minimal volatility with stable regional currencies",
      "Small gold allocation for inflation protection",
      "Focus on developed market stablecoins",
      "Cross-chain diversification across Celo, Arc, and Arbitrum"
    ],
    expectedReturn: "3-4%",
    maxDrawdown: "<5%"
  },
  balanced: {
    name: "Balanced",
    description: "Mix of regional stability and commodity protection",
    riskLevel: "MEDIUM" as const,
    icon: "⚖️",
    color: "from-blue-500 to-indigo-600",
    allocations: {
      USA: 0.25,
      Europe: 0.2,
      Asia: 0.15,
      LatAm: 0.15,
      Africa: 0.1,
      Commodities: 0.15,
    },
    benefits: [
      "Balanced exposure across regions and asset classes",
      "Meaningful commodity allocation for inflation hedge",
      "Diversified across multiple blockchain networks",
      "Optimal risk-adjusted returns"
    ],
    expectedReturn: "4-6%",
    maxDrawdown: "<10%"
  },
  growth: {
    name: "Growth",
    description: "Higher exposure to emerging markets",
    riskLevel: "MEDIUM" as const,
    icon: "📈",
    color: "from-purple-500 to-indigo-600",
    allocations: {
      USA: 0.2,
      Europe: 0.15,
      Asia: 0.2,
      LatAm: 0.2,
      Africa: 0.15,
      Commodities: 0.1,
    },
    benefits: [
      "Higher exposure to high-growth emerging markets",
      "Commodity backing provides stability anchor",
      "Leverages multichain ecosystem for maximum opportunities",
      "Balanced growth with inflation protection"
    ],
    expectedReturn: "6-8%",
    maxDrawdown: "<15%"
  },
  inflationHedge: {
    name: "Inflation Hedge",
    description: "Maximum inflation protection",
    riskLevel: "HIGH" as const,
    icon: "🔥",
    color: "from-amber-500 to-orange-600",
    allocations: {
      USA: 0.2,
      Europe: 0.2,
      Asia: 0.15,
      LatAm: 0.15,
      Africa: 0.1,
      Commodities: 0.2,
    },
    benefits: [
      "Maximum inflation protection through commodity exposure",
      "Gold allocation hedges against currency debasement",
      "Regional diversification reduces single-currency risk",
      "Multichain strategy leverages best assets on each network"
    ],
    expectedReturn: "5-7%",
    maxDrawdown: "<20%"
  },
};

// Calculate potential allocation adjustments
const calculatePotentialAdjustments = (
  currentAllocations: Record<string, number>,
  targetStrategy: keyof typeof PORTFOLIO_STRATEGIES
) => {
  const targetAllocations = PORTFOLIO_STRATEGIES[targetStrategy].allocations;
  const swaps: Array<{ from: string; to: string; percentage: number }> = [];

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
      swaps.push({
        from: overRegion,
        to: underRegion,
        percentage: Math.round(swapAmount * 100),
      });
    }

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

const getRiskBadgeColor = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
  switch (risk) {
    case 'LOW': return 'bg-green-500 text-white';
    case 'MEDIUM': return 'bg-blue-500 text-white';
    case 'HIGH': return 'bg-amber-500 text-white';
  }
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
    useState<keyof typeof PORTFOLIO_STRATEGIES>("balanced");
  const [showBenefits, setShowBenefits] = useState(false);

  const potentialAdjustments = calculatePotentialAdjustments(
    currentAllocations,
    selectedStrategy
  );

  const handleStrategyChange = (
    strategy: keyof typeof PORTFOLIO_STRATEGIES
  ) => {
    setSelectedStrategy(strategy);
    if (onSelectStrategy) {
      onSelectStrategy(strategy);
    }
  };

  const currentStrategy = PORTFOLIO_STRATEGIES[selectedStrategy];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl backdrop-blur-sm">
              {currentStrategy.icon}
            </div>
            <div>
              <h2 className="text-white font-black text-lg uppercase tracking-tight">
                Portfolio Strategies
              </h2>
              <p className="text-gray-400 text-xs">AI-Powered Allocation</p>
            </div>
          </div>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
            World Bank • Alpha Vantage
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Strategy Cards */}
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(PORTFOLIO_STRATEGIES).map(([key, strategy]) => (
            <motion.button
              key={key}
              onClick={() => handleStrategyChange(key as keyof typeof PORTFOLIO_STRATEGIES)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`relative p-3 rounded-xl border-2 transition-all text-left ${
                selectedStrategy === key
                  ? `border-transparent bg-gradient-to-br ${strategy.color} text-white shadow-lg`
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{strategy.icon}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  selectedStrategy === key 
                    ? "bg-white/30 text-white" 
                    : getRiskBadgeColor(strategy.riskLevel)
                }`}>
                  {strategy.riskLevel}
                </span>
              </div>
              <h3 className="font-bold text-sm mb-1">{strategy.name}</h3>
              <p className={`text-xs ${selectedStrategy === key ? "text-white/80" : "text-gray-500 dark:text-gray-400"}`}>
                {strategy.description}
              </p>
              
              {/* Expected Returns */}
              <div className="mt-2 flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  selectedStrategy === key 
                    ? "bg-white/20 text-white" 
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}>
                  ↗ {strategy.expectedReturn}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  selectedStrategy === key 
                    ? "bg-white/20 text-white" 
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                }`}>
                  ↓ {strategy.maxDrawdown}
                </span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Allocation Visualization */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
            <span>📊</span> Strategy Allocation
          </h3>
          
          {/* Stacked Bar */}
          <div className="flex rounded-lg overflow-hidden mb-3 h-8 shadow-inner">
            {Object.entries(currentStrategy.allocations).map(([region, allocation]) => (
              <div
                key={region}
                className={`h-full bg-gradient-to-r ${REGION_METADATA[region as keyof typeof REGION_METADATA]?.gradient || "from-gray-400 to-gray-500"}`}
                style={{ width: `${allocation * 100}%` }}
                title={`${region}: ${(allocation * 100).toFixed(0)}%`}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(currentStrategy.allocations).map(([region, allocation]) => (
              <div key={region} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${REGION_METADATA[region as keyof typeof REGION_METADATA]?.gradient || "from-gray-400 to-gray-500"}`} />
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {REGION_METADATA[region as keyof typeof REGION_METADATA]?.icon || "📍"} {(allocation * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Adjustments */}
        <AnimatePresence mode="wait">
          {potentialAdjustments.length > 0 ? (
            <motion.div
              key="adjustments"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                <span>🔄</span> Recommended Adjustments
              </h3>
              
              <div className="space-y-2">
                {potentialAdjustments.map((swap, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${REGION_METADATA[swap.from as keyof typeof REGION_METADATA]?.gradient || "from-gray-400 to-gray-500"} flex items-center justify-center text-sm`}>
                          {REGION_METADATA[swap.from as keyof typeof REGION_METADATA]?.icon}
                        </div>
                        <span className="font-bold text-sm text-gray-900 dark:text-white">{swap.from}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-lg">→</span>
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-2 py-1 rounded-full">
                          {swap.percentage}%
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${REGION_METADATA[swap.to as keyof typeof REGION_METADATA]?.gradient || "from-gray-400 to-gray-500"} flex items-center justify-center text-sm`}>
                          {REGION_METADATA[swap.to as keyof typeof REGION_METADATA]?.icon}
                        </div>
                        <span className="font-bold text-sm text-gray-900 dark:text-white">{swap.to}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="aligned"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-xl">
                  ✓
                </div>
                <div>
                  <h4 className="font-bold text-green-900 dark:text-green-100">Portfolio Aligned</h4>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Your current allocation matches the {currentStrategy.name} strategy
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Strategy Benefits */}
        <motion.button
          onClick={() => setShowBenefits(!showBenefits)}
          className="w-full p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-blue-900 dark:text-blue-100 text-sm">
              💡 Why {currentStrategy.name}?
            </span>
            <motion.span
              animate={{ rotate: showBenefits ? 180 : 0 }}
              className="text-blue-600 dark:text-blue-400"
            >
              ▼
            </motion.span>
          </div>
          
          <AnimatePresence>
            {showBenefits && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <ul className="mt-3 space-y-2 text-left">
                  {currentStrategy.benefits.map((benefit, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200">
                      <span className="text-blue-500 mt-0.5">✓</span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </div>
  );
}
