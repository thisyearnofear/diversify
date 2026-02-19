import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// GOAL DEFINITIONS - Single source of truth for goal types
// ============================================================================
const GOAL_TYPES = [
  {
    id: "education",
    title: "Education Fund",
    description: "Save for international education expenses with inflation protection",
    icon: "🎓",
    defaultAmount: 10000,
    defaultTimeframe: 36,
    recommendedStrategy: "balanced",
    regions: ["USA", "Europe"],
    commodityAllocation: 15,
    chains: ["Arc", "Arbitrum"],
    benefits: [
      "Protection against education cost inflation",
      "Gold allocation hedges against currency devaluation",
      "Cross-chain diversification reduces single-network risk"
    ],
    // Real-world context from World Bank data
    worldBankContext: "Parents saving for international education can hold stablecoins from the region where their children plan to study, protecting against currency fluctuations.",
  },
  {
    id: "travel",
    title: "Travel Fund",
    description: "Save for international travel with stable purchasing power",
    icon: "✈️",
    defaultAmount: 3000,
    defaultTimeframe: 12,
    recommendedStrategy: "conservative",
    regions: ["Europe", "Asia", "LatAm"],
    commodityAllocation: 10,
    chains: ["Celo", "Arc", "Arbitrum"],
    benefits: [
      "Stable value across multiple travel destinations",
      "Small commodity buffer against travel cost inflation",
      "Regional currency exposure for destination spending"
    ],
    worldBankContext: "Frequent travelers can hold stablecoins from regions they visit regularly, avoiding exchange rate losses and conversion fees.",
  },
  {
    id: "remittance",
    title: "Remittance Fund",
    description: "Optimize cross-border transfers with multichain efficiency",
    icon: "💸",
    defaultAmount: 5000,
    defaultTimeframe: 24,
    recommendedStrategy: "balanced",
    regions: ["Asia", "LatAm", "Africa"],
    commodityAllocation: 10,
    chains: ["Celo", "Arbitrum"],
    benefits: [
      "Lower fees through multichain routing",
      "Commodity backing protects recipient purchasing power",
      "Regional stablecoin exposure matches recipient needs"
    ],
    worldBankContext: "A Filipino worker sending money home from the US can save up to 7% in fees by using a mix of USDm and regional stablecoins instead of traditional remittance services.",
  },
  {
    id: "business",
    title: "Business Protection",
    description: "Hedge operational costs and supply chain inflation",
    icon: "🏭",
    defaultAmount: 20000,
    defaultTimeframe: 18,
    recommendedStrategy: "inflationHedge",
    regions: ["USA", "Europe", "Asia"],
    commodityAllocation: 25,
    chains: ["Arc", "Arbitrum", "Celo"],
    benefits: [
      "Strong commodity hedge against supply chain inflation",
      "Multi-regional exposure matches global business operations",
      "Cross-chain flexibility for international payments"
    ],
    worldBankContext: "A business that imports goods from Europe can hold stablecoins from that region to protect against exchange rate fluctuations.",
  },
  {
    id: "emergency",
    title: "Emergency Fund",
    description: "Build a crisis-resistant safety net with real asset backing",
    icon: "🛡️",
    defaultAmount: 5000,
    defaultTimeframe: 6,
    recommendedStrategy: "conservative",
    regions: ["USA", "Europe"],
    commodityAllocation: 15,
    chains: ["Arc", "Arbitrum"],
    benefits: [
      "Gold allocation provides crisis-resistant store of value",
      "Stable regional currencies for immediate liquidity",
      "Multichain access ensures fund availability"
    ],
    worldBankContext: "In many emerging markets, local currencies can lose 10-30% of their value in a single year. An emergency fund with commodity backing preserves value during crises.",
  },
];

// ============================================================================
// USE CASES - Educational content
// ============================================================================
const USE_CASES = [
  {
    title: "Protection from Local Currency Devaluation",
    description:
      "When the Kenyan Shilling lost 20% of its value against the USD in 2022, Kenyans who had diversified into EURm and USDm preserved more of their savings.",
    icon: "🛡️",
    region: "Africa",
  },
  {
    title: "Remittance Cost Savings",
    description:
      "A Filipino worker sending money home from the US can save up to 7% in fees by using a mix of USDm and regional stablecoins instead of traditional remittance services.",
    icon: "💸",
    region: "Asia",
  },
  {
    title: "Business Import/Export Protection",
    description:
      "A Colombian business that imports goods from Europe can hold EURm to protect against COPm/EURm exchange rate fluctuations.",
    icon: "🏭",
    region: "LatAm",
  },
  {
    title: "Education Fund Preservation",
    description:
      "Parents saving for international education can hold stablecoins from the region where their children plan to study, protecting against currency fluctuations.",
    icon: "🎓",
    region: "Global",
  },
  {
    title: "Travel Expense Management",
    description:
      "Frequent travelers can hold stablecoins from regions they visit regularly, avoiding exchange rate losses and conversion fees.",
    icon: "✈️",
    region: "Global",
  },
];

interface RealWorldUseCasesProps {
  focusRegion?: string;
  onSelectGoal?: (goalId: string) => void;
}

export default function RealWorldUseCases({
  focusRegion,
  onSelectGoal,
}: RealWorldUseCasesProps) {
  const [activeGoal, setActiveGoal] = useState<string>("education");
  const [goalAmount, setGoalAmount] = useState<number>(10000);
  const [timeframeMonths, setTimeframeMonths] = useState<number>(36);
  const [showCalculator, setShowCalculator] = useState(false);

  // Find the currently active goal
  const currentGoal =
    GOAL_TYPES.find((goal) => goal.id === activeGoal) || GOAL_TYPES[0];

  // Calculate monthly savings needed
  const monthlySavingsNeeded = goalAmount / timeframeMonths;

  // Calculate estimated value after timeframe (with 3% annual inflation protection)
  const estimatedValue = goalAmount * (1 + (0.03 * timeframeMonths) / 12);

  // Filter use cases if a focus region is provided
  const filteredCases = focusRegion
    ? USE_CASES.filter(
        (useCase) =>
          useCase.region === focusRegion || useCase.region === "Global"
      )
    : USE_CASES;

  // Handle goal selection
  const handleGoalSelect = (goalId: string) => {
    const goal = GOAL_TYPES.find((g) => g.id === goalId);
    if (goal) {
      setActiveGoal(goalId);
      setGoalAmount(goal.defaultAmount);
      setTimeframeMonths(goal.defaultTimeframe);
      setShowCalculator(true);
      onSelectGoal?.(goalId);
    }
  };

  return (
    <div className="space-y-4">
      {/* Interactive Goal Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="size-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-lg">💡</div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Select Your Goal</h3>
            <p className="text-sm font-bold text-gray-900 dark:text-white">Practical Applications</p>
          </div>
        </div>

        {/* Goal Tabs */}
        <div className="flex overflow-x-auto mb-4 pb-1 scrollbar-hide -mx-1 px-1">
          {GOAL_TYPES.map((goal) => (
            <motion.button
              key={goal.id}
              className={`px-3 py-2 mr-2 rounded-xl whitespace-nowrap flex items-center transition-all ${
                activeGoal === goal.id
                  ? "bg-purple-600 text-white font-bold shadow-lg shadow-purple-500/20"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold"
              }`}
              onClick={() => handleGoalSelect(goal.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className={activeGoal === goal.id ? "mr-1.5 text-base" : "mr-1 text-sm opacity-70"}>
                {goal.icon}
              </span>
              <span className="text-[10px]">{goal.title}</span>
            </motion.button>
          ))}
        </div>

        {/* Selected Goal Details */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGoal}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-purple-50/50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30"
          >
            <div className="flex items-start gap-3 mb-3">
              <motion.div
                className="text-3xl bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-purple-50 dark:border-purple-900/20"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                {currentGoal.icon}
              </motion.div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-purple-900 dark:text-purple-100 uppercase tracking-tight">
                  {currentGoal.title}
                </h4>
                <p className="text-xs text-purple-700/80 dark:text-purple-300/80 mt-1 font-medium leading-relaxed">
                  {currentGoal.description}
                </p>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {currentGoal.regions.map((region) => (
                <span
                  key={region}
                  className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50"
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

            {/* World Bank Context */}
            <div className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed italic mb-3">
              💡 {currentGoal.worldBankContext}
            </div>

            {/* Expandable Calculator */}
            <button
              onClick={() => setShowCalculator(!showCalculator)}
              className="w-full flex items-center justify-between p-2 bg-white dark:bg-gray-900 rounded-lg border border-purple-100 dark:border-purple-800/30 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
            >
              <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                {showCalculator ? "Hide Calculator" : "Calculate Your Plan"}
              </span>
              <motion.span
                animate={{ rotate: showCalculator ? 180 : 0 }}
                className="text-purple-500"
              >
                ▼
              </motion.span>
            </button>

            <AnimatePresence>
              {showCalculator && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-3">
                    {/* Goal Amount */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                        Goal Amount
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">$</span>
                        <input
                          type="number"
                          value={goalAmount}
                          onChange={(e) => setGoalAmount(Number(e.target.value))}
                          className="w-full pl-7 pr-3 py-2 text-sm border-2 border-gray-100 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-black outline-none focus:border-purple-400 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Timeframe */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                          Timeframe
                        </label>
                        <span className="text-[10px] font-black text-purple-600">{timeframeMonths} months</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="60"
                        value={timeframeMonths}
                        onChange={(e) => setTimeframeMonths(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                      />
                    </div>

                    {/* Results */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                        <div className="text-[9px] font-black uppercase text-gray-400">Monthly</div>
                        <div className="text-lg font-black text-purple-600">
                          ${monthlySavingsNeeded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                      <div className="bg-white dark:bg-gray-900 p-2 rounded-lg border border-gray-100 dark:border-gray-700">
                        <div className="text-[9px] font-black uppercase text-gray-400">Target</div>
                        <div className="text-lg font-black text-emerald-600">
                          ${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-2 rounded-lg border border-emerald-100/50 dark:border-emerald-900/30">
                      <ul className="space-y-1">
                        {currentGoal.benefits.slice(0, 2).map((benefit, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-500 text-[10px] mt-0.5">✓</span>
                            <span className="text-[10px] font-bold text-emerald-700/80 dark:text-emerald-400/80">{benefit}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Educational Content - Collapsible */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">Wealth Outcomes</h2>
          <span className="text-[10px] font-bold text-gray-400 uppercase">WORLD BANK DATA</span>
        </div>

        <div className="space-y-3">
          {filteredCases.map((useCase, index) => (
            <div
              key={index}
              className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-50 dark:border-gray-800 hover:border-blue-100 dark:hover:border-blue-900 transition-colors group"
            >
              <div className="flex items-start">
                <div className="text-2xl mr-4 group-hover:scale-110 transition-transform duration-300">{useCase.icon}</div>
                <div>
                  <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-tight mb-1">{useCase.title}</h3>
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
                    {useCase.description}
                  </p>
                  {useCase.region !== "Global" && (
                    <div className="mt-2">
                      <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                        {useCase.region}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 p-4 bg-gray-900 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl -mr-12 -mt-12" />
          <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2 relative">WHY IT MATTERS</h3>
          <p className="text-[11px] font-bold text-white leading-relaxed relative">
            In many emerging markets, local currencies can lose 10-30% of their
            value in a single year. Geographic diversification is the <span className="text-blue-400">ultimate hedge</span>.
          </p>
        </div>
      </div>
    </div>
  );
}

// Export goal types for external use
export { GOAL_TYPES };
