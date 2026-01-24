import React, { useState } from "react";
import type { Region } from "@/hooks/use-user-region";

// Define goal types based on real-world use cases with multichain considerations
const GOAL_TYPES = [
  {
    id: "education",
    title: "Education Fund",
    description: "Save for international education expenses with inflation protection",
    icon: "🎓",
    defaultAmount: 10000,
    defaultTimeframe: 36, // 3 years in months
    recommendedStrategy: "balanced",
    regions: ["USA", "Europe"],
    commodityAllocation: 15,
    chains: ["Arc", "Arbitrum"],
    benefits: [
      "Protection against education cost inflation",
      "Gold allocation hedges against currency devaluation",
      "Cross-chain diversification reduces single-network risk"
    ]
  },
  {
    id: "travel",
    title: "Travel Fund",
    description: "Save for international travel with stable purchasing power",
    icon: "✈️",
    defaultAmount: 3000,
    defaultTimeframe: 12, // 1 year in months
    recommendedStrategy: "conservative",
    regions: ["Europe", "Asia", "LatAm"],
    commodityAllocation: 10,
    chains: ["Celo", "Arc", "Arbitrum"],
    benefits: [
      "Stable value across multiple travel destinations",
      "Small commodity buffer against travel cost inflation",
      "Regional currency exposure for destination spending"
    ]
  },
  {
    id: "remittance",
    title: "Remittance Fund",
    description: "Optimize cross-border transfers with multichain efficiency",
    icon: "💸",
    defaultAmount: 5000,
    defaultTimeframe: 24, // 2 years in months
    recommendedStrategy: "balanced",
    regions: ["Asia", "LatAm", "Africa"],
    commodityAllocation: 10,
    chains: ["Celo", "Arbitrum"],
    benefits: [
      "Lower fees through multichain routing",
      "Commodity backing protects recipient purchasing power",
      "Regional stablecoin exposure matches recipient needs"
    ]
  },
  {
    id: "business",
    title: "Business Protection",
    description: "Hedge operational costs and supply chain inflation",
    icon: "🏭",
    defaultAmount: 20000,
    defaultTimeframe: 18, // 1.5 years in months
    recommendedStrategy: "inflationHedge",
    regions: ["USA", "Europe", "Asia"],
    commodityAllocation: 25,
    chains: ["Arc", "Arbitrum", "Celo"],
    benefits: [
      "Strong commodity hedge against supply chain inflation",
      "Multi-regional exposure matches global business operations",
      "Cross-chain flexibility for international payments"
    ]
  },
  {
    id: "emergency",
    title: "Emergency Fund",
    description: "Build a crisis-resistant safety net with real asset backing",
    icon: "🛡️",
    defaultAmount: 5000,
    defaultTimeframe: 6, // 6 months
    recommendedStrategy: "conservative",
    regions: ["USA", "Europe"],
    commodityAllocation: 15,
    chains: ["Arc", "Arbitrum"],
    benefits: [
      "Gold allocation provides crisis-resistant store of value",
      "Stable regional currencies for immediate liquidity",
      "Multichain access ensures fund availability"
    ]
  },
];

// Strategy options
const STRATEGY_OPTIONS = [
  {
    id: "conservative",
    name: "Conservative",
    description: "Lower risk, stable returns",
  },
  {
    id: "balanced",
    name: "Balanced",
    description: "Moderate risk and returns",
  },
  {
    id: "growth",
    name: "Growth",
    description: "Higher risk, potential for better returns",
  },
  {
    id: "inflationHedge",
    name: "Inflation Hedge",
    description: "Optimized for inflation protection",
  },
];

interface GoalBasedStrategiesProps {
  userRegion: Region;
  onSelectStrategy: (strategy: string) => void;
}

export default function GoalBasedStrategies({
  userRegion,
  onSelectStrategy,
}: GoalBasedStrategiesProps) {
  const [activeGoal, setActiveGoal] = useState<string>("education");
  const [goalAmount, setGoalAmount] = useState<number>(10000);
  const [timeframeMonths, setTimeframeMonths] = useState<number>(36);
  const [selectedStrategy, setSelectedStrategy] = useState<string>("balanced");

  // Find the currently active goal
  const currentGoal =
    GOAL_TYPES.find((goal) => goal.id === activeGoal) || GOAL_TYPES[0];

  // Calculate monthly savings needed
  const monthlySavingsNeeded = goalAmount / timeframeMonths;

  // Calculate estimated value after timeframe (with a simple 3% annual inflation protection)
  const estimatedValue = goalAmount * (1 + (0.03 * timeframeMonths) / 12);

  // Handle strategy change
  const handleStrategyChange = (strategy: string) => {
    setSelectedStrategy(strategy);
    onSelectStrategy(strategy);
  };

  // Handle goal selection
  const handleGoalSelect = (goalId: string) => {
    const goal = GOAL_TYPES.find((g) => g.id === goalId);
    if (goal) {
      setActiveGoal(goalId);
      setGoalAmount(goal.defaultAmount);
      setTimeframeMonths(goal.defaultTimeframe);
      handleStrategyChange(goal.recommendedStrategy);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-4 mb-4 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Goal-Based Strategies
        </h2>
        <span className="text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
          Based on World Bank data
        </span>
      </div>

      {/* Goal Type Tabs */}
      <div className="flex overflow-x-auto mb-4 pb-1">
        {GOAL_TYPES.map((goal) => (
          <button
            key={goal.id}
            className={`px-3 py-2 mr-2 rounded-md whitespace-nowrap flex items-center ${activeGoal === goal.id
              ? "bg-blue-100 text-blue-800 font-medium"
              : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            onClick={() => handleGoalSelect(goal.id)}
          >
            <span className="mr-1">{goal.icon}</span>
            <span className="text-sm">{goal.title}</span>
          </button>
        ))}
      </div>

      <div className="bg-blue-50 p-3 rounded-md mb-4">
        <div className="flex items-start">
          <div className="text-2xl mr-3">{currentGoal.icon}</div>
          <div className="flex-1">
            <h3 className="font-medium text-blue-800">{currentGoal.title}</h3>
            <p className="text-sm text-blue-600 mt-1">
              {currentGoal.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {currentGoal.regions.map((region) => (
                <span
                  key={region}
                  className={`inline-block text-xs px-2 py-1 rounded-full ${region === userRegion
                    ? "bg-blue-200 text-blue-800 font-medium"
                    : "bg-blue-100 text-blue-700"
                    }`}
                >
                  {region}
                </span>
              ))}
              <span className="inline-block text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                🥇 {currentGoal.commodityAllocation}% Gold
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {currentGoal.chains.map((chain) => (
                <span
                  key={chain}
                  className="inline-block text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700"
                >
                  {chain}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Calculator */}
      <div className="space-y-4 mb-4">
        <div>
          <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
            Goal Amount
          </label>
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-700 dark:text-gray-300 font-medium sm:text-sm">$</span>
            </div>
            <input
              type="number"
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100 dark:bg-gray-800 font-medium placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="0.00"
              value={goalAmount}
              onChange={(e) => setGoalAmount(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
            Timeframe (months)
          </label>
          <input
            type="range"
            min="1"
            max="60"
            value={timeframeMonths}
            onChange={(e) => setTimeframeMonths(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-700 dark:text-gray-300 font-medium mt-1">
            <span>1 month</span>
            <span>{timeframeMonths} months</span>
            <span>5 years</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
            Recommended Strategy
          </label>
          <select
            className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100 dark:bg-gray-800 bg-white appearance-none cursor-pointer"
            value={selectedStrategy}
            onChange={(e) => handleStrategyChange(e.target.value)}
          >
            {STRATEGY_OPTIONS.map((strategy) => (
              <option key={strategy.id} value={strategy.id} className="dark:bg-gray-800 dark:text-gray-100">
                {strategy.name} - {strategy.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
          <div className="text-sm text-gray-500 dark:text-gray-400">Monthly Savings Needed</div>
          <div className="text-xl font-semibold text-blue-600 dark:text-blue-400">
            ${monthlySavingsNeeded.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
          <div className="text-sm text-gray-500 dark:text-gray-400">Estimated Value</div>
          <div className="text-xl font-semibold text-green-600 dark:text-green-400">
            ${estimatedValue.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            After {timeframeMonths} months
          </div>
        </div>
      </div>

      {/* Strategy Benefits */}
      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
        <h3 className="font-medium text-green-700 dark:text-green-300 mb-2">Strategy Benefits</h3>
        <ul className="text-sm text-green-600 dark:text-green-400 list-disc pl-5 space-y-1">
          {currentGoal.benefits.map((benefit, index) => (
            <li key={index}>{benefit}</li>
          ))}
          <li>Monthly savings target: ${monthlySavingsNeeded.toFixed(2)}</li>
          <li>Flexible timeframe to meet your {timeframeMonths}-month goal</li>
        </ul>
      </div>

      <div className="mt-4 flex justify-between"></div>
    </div>
  );
}
