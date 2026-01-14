import React, { useState } from "react";
import type { Region } from "@/hooks/use-user-region";

// Define goal types based on real-world use cases
const GOAL_TYPES = [
  {
    id: "education",
    title: "Education Fund",
    description: "Save for international education expenses",
    icon: "🎓",
    defaultAmount: 10000,
    defaultTimeframe: 36, // 3 years in months
    recommendedStrategy: "balanced",
    regions: ["USA", "Europe"],
  },
  {
    id: "travel",
    title: "Travel Fund",
    description: "Save for international travel expenses",
    icon: "✈️",
    defaultAmount: 3000,
    defaultTimeframe: 12, // 1 year in months
    recommendedStrategy: "conservative",
    regions: ["Europe", "Asia", "LatAm"],
  },
  {
    id: "remittance",
    title: "Remittance Fund",
    description: "Save on fees when sending money internationally",
    icon: "💸",
    defaultAmount: 5000,
    defaultTimeframe: 24, // 2 years in months
    recommendedStrategy: "balanced",
    regions: ["Asia", "LatAm"],
  },
  {
    id: "business",
    title: "Business Protection",
    description: "Protect against exchange rate fluctuations for your business",
    icon: "🏭",
    defaultAmount: 20000,
    defaultTimeframe: 18, // 1.5 years in months
    recommendedStrategy: "inflationHedge",
    regions: ["USA", "Europe", "LatAm"],
  },
  {
    id: "emergency",
    title: "Emergency Fund",
    description: "Build a safety net that maintains its value",
    icon: "🛡️",
    defaultAmount: 5000,
    defaultTimeframe: 6, // 6 months
    recommendedStrategy: "conservative",
    regions: ["USA", "Europe"],
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
    <div className="bg-white rounded-lg shadow-md p-4 mb-4 border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Goal-Based Strategies
        </h2>
        <span className="text-xs text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
          Based on World Bank data
        </span>
      </div>

      {/* Goal Type Tabs */}
      <div className="flex overflow-x-auto mb-4 pb-1">
        {GOAL_TYPES.map((goal) => (
          <button
            key={goal.id}
            className={`px-3 py-2 mr-2 rounded-md whitespace-nowrap flex items-center ${
              activeGoal === goal.id
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
          <div>
            <h3 className="font-medium text-blue-800">{currentGoal.title}</h3>
            <p className="text-sm text-blue-600 mt-1">
              {currentGoal.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {currentGoal.regions.map((region) => (
                <span
                  key={region}
                  className={`inline-block text-xs px-2 py-1 rounded-full ${
                    region === userRegion
                      ? "bg-blue-200 text-blue-800 font-medium"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {region}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Goal Calculator */}
      <div className="space-y-4 mb-4">
        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Goal Amount
          </label>
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-700 font-medium sm:text-sm">$</span>
            </div>
            <input
              type="number"
              className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md shadow-sm text-gray-900 font-medium"
              placeholder="0.00"
              value={goalAmount}
              onChange={(e) => setGoalAmount(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Timeframe (months)
          </label>
          <input
            type="range"
            min="1"
            max="60"
            value={timeframeMonths}
            onChange={(e) => setTimeframeMonths(Number(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-700 font-medium mt-1">
            <span>1 month</span>
            <span>{timeframeMonths} months</span>
            <span>5 years</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-900 mb-1">
            Recommended Strategy
          </label>
          <select
            className="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md shadow-sm text-gray-900"
            value={selectedStrategy}
            onChange={(e) => handleStrategyChange(e.target.value)}
          >
            {STRATEGY_OPTIONS.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>
                {strategy.name} - {strategy.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 p-3 rounded-md">
          <div className="text-sm text-gray-500">Monthly Savings Needed</div>
          <div className="text-xl font-semibold text-blue-600">
            ${monthlySavingsNeeded.toFixed(2)}
          </div>
        </div>

        <div className="bg-gray-50 p-3 rounded-md">
          <div className="text-sm text-gray-500">Estimated Value</div>
          <div className="text-xl font-semibold text-green-600">
            ${estimatedValue.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            After {timeframeMonths} months
          </div>
        </div>
      </div>

      {/* Strategy Benefits */}
      <div className="bg-green-50 p-3 rounded-md">
        <h3 className="font-medium text-green-700 mb-2">Strategy Benefits</h3>
        <ul className="text-sm text-green-600 list-disc pl-5 space-y-1">
          <li>
            Protection against inflation in {currentGoal.regions.join(" and ")}{" "}
            regions
          </li>
          <li>Optimized for {currentGoal.title.toLowerCase()} expenses</li>
          <li>Automatic monthly savings recommendations</li>
          <li>Flexible timeframe to meet your goals</li>
        </ul>
      </div>

      <div className="mt-4 flex justify-between"></div>
    </div>
  );
}
