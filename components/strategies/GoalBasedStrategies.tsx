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
    <div className="w-full">
      {/* Goal Type Tabs */}
      <div className="flex overflow-x-auto mb-4 pb-1 scrollbar-hide">
        {GOAL_TYPES.map((goal) => (
          <button
            key={goal.id}
            className={`px-3 py-2 mr-2 rounded-xl whitespace-nowrap flex items-center transition-all ${activeGoal === goal.id
              ? "bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 font-bold uppercase text-[10px] tracking-tight"
              }`}
            onClick={() => handleGoalSelect(goal.id)}
          >
            <span className={activeGoal === goal.id ? "mr-1.5 text-base" : "mr-1 text-sm opacity-70"}>{goal.icon}</span>
            <span className={activeGoal === goal.id ? "text-xs" : "text-[10px]"}>{goal.title}</span>
          </button>
        ))}
      </div>

      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl mb-4 border border-blue-100 dark:border-blue-900/30">
        <div className="flex items-start gap-3">
          <div className="text-3xl bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-blue-50 dark:border-blue-900/20">
            {currentGoal.icon}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black text-blue-900 dark:text-blue-100 uppercase tracking-tight">{currentGoal.title}</h3>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80 mt-1 font-medium leading-relaxed">
              {currentGoal.description}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {currentGoal.regions.map((region) => (
            <span
              key={region}
              className={`inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded ${region === userRegion
                ? "bg-blue-600 text-white"
                : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50"
                }`}
            >
              {region}
            </span>
          ))}
          <span className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50">
            🥇 {currentGoal.commodityAllocation}% Gold
          </span>
          {currentGoal.chains.map((chain) => (
            <span
              key={chain}
              className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
            >
              {chain}
            </span>
          ))}
        </div>
      </div>

      {/* Goal Calculator */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
            Goal Amount
          </label>
          <div className="relative rounded-xl shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400 font-black text-xs">$</span>
            </div>
            <input
              type="number"
              className="focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-7 pr-3 py-2 text-sm border-2 border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-black outline-none transition-all"
              placeholder="0"
              value={goalAmount}
              onChange={(e) => setGoalAmount(Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">
            Strategy
          </label>
          <div className="relative">
            <select
              className="appearance-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full px-3 py-2 text-sm border-2 border-gray-100 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-black outline-none transition-all cursor-pointer"
              value={selectedStrategy}
              onChange={(e) => handleStrategyChange(e.target.value)}
            >
              {STRATEGY_OPTIONS.map((strategy) => (
                <option key={strategy.id} value={strategy.id} className="dark:bg-gray-900 font-bold">
                  {strategy.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 7.293 8.172 5.879 9.586l3.414 3.414z"/></svg>
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <div className="flex justify-between items-center mb-1.5">
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">
              Timeframe: <span className="text-blue-600">{timeframeMonths} Months</span>
            </label>
            <span className="text-[10px] font-black text-gray-300 uppercase">5yr Max</span>
          </div>
          <input
            type="range"
            min="1"
            max="60"
            value={timeframeMonths}
            onChange={(e) => setTimeframeMonths(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Monthly Goal</div>
          <div className="text-lg font-black text-blue-600 dark:text-blue-400">
            ${monthlySavingsNeeded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Target Value</div>
          <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
            ${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      {/* Strategy Benefits */}
      <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30">
        <div className="flex items-center gap-2 mb-2">
          <div className="size-1.5 rounded-full bg-emerald-500" />
          <h3 className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-widest">Strategy Benefits</h3>
        </div>
        <ul className="grid grid-cols-1 gap-1.5">
          {currentGoal.benefits.slice(0, 2).map((benefit, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-emerald-500 text-[10px] mt-0.5">✓</span>
              <span className="text-[10px] font-bold text-emerald-700/80 dark:text-emerald-400/80 leading-tight">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
