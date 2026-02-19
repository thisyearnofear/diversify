import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// GOAL DEFINITIONS - Single source of truth
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
      "Cross-chain diversification reduces single-network risk",
    ],
    // Real-world examples to show in accordion
    examples: [
      {
        title: "🇺🇸 US → UK",
        description: "Parents holding GBP stablecoins save 12% vs USD when tuition is due",
        metric: "12% saved",
      },
      {
        title: "🇮🇳 India Study Fund",
        description: "Holding INR-stablecoins protects against rupee depreciation over 4 years",
        metric: "8% annual hedge",
      },
    ],
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
      "Regional currency exposure for destination spending",
    ],
    examples: [
      {
        title: "🇺🇸 Frequent Flyer",
        description: "Holding EUR + JPY stablecoins avoids 7% conversion fees per trip",
        metric: "$210/year saved",
      },
      {
        title: "🇪🇺 Euro Traveler",
        description: "Euro-denominated funds stay stable regardless of USD fluctuations",
        metric: "Zero FX loss",
      },
    ],
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
      "Regional stablecoin exposure matches recipient needs",
    ],
    examples: [
      {
        title: "🇵🇭 US → Philippines",
        description: "Using PHP-stablecoins saves 7% vs Western Union fees",
        metric: "$350/year saved",
      },
      {
        title: "🇲🇽 US → Mexico",
        description: "MXN stablecoins arrive in minutes with near-zero fees",
        metric: "96% faster",
      },
    ],
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
      "Cross-chain flexibility for international payments",
    ],
    examples: [
      {
        title: "🇨🇴 Import/Export",
        description: "Colombian business holds EUR to protect against COP/EUR swings",
        metric: "15% risk reduced",
      },
      {
        title: "🇨🇳 Supplier Payments",
        description: "Holding CNY-stablecoins locks in rates for quarterly payments",
        metric: "Quarterly certainty",
      },
    ],
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
      "Multichain access ensures fund availability",
    ],
    examples: [
      {
        title: "🇰🇪 Kenya Crisis",
        description: "When KES lost 20% in 2022, EURm holders preserved 80% more wealth",
        metric: "80% preserved",
      },
      {
        title: "🇦🇷 Argentina",
        description: "USD-stablecoins protect against 50%+ annual inflation",
        metric: "50%+ protected",
      },
    ],
  },
];

interface RealWorldUseCasesProps {
  onSelectGoal?: (goalId: string) => void;
}

export default function RealWorldUseCases({
  onSelectGoal,
}: RealWorldUseCasesProps) {
  const [activeGoal, setActiveGoal] = useState<string>("education");
  const [goalAmount, setGoalAmount] = useState<number>(10000);
  const [timeframeMonths, setTimeframeMonths] = useState<number>(36);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showExamples, setShowExamples] = useState(true);

  const currentGoal =
    GOAL_TYPES.find((goal) => goal.id === activeGoal) || GOAL_TYPES[0];

  const monthlySavingsNeeded = goalAmount / timeframeMonths;
  const estimatedValue = goalAmount * (1 + (0.03 * timeframeMonths) / 12);

  const handleGoalSelect = (goalId: string) => {
    const goal = GOAL_TYPES.find((g) => g.id === goalId);
    if (goal) {
      setActiveGoal(goalId);
      setGoalAmount(goal.defaultAmount);
      setTimeframeMonths(goal.defaultTimeframe);
      setShowExamples(true); // Auto-show examples for new goal
      onSelectGoal?.(goalId);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="size-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center text-lg">
          💡
        </div>
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
            Wealth Goals
          </h3>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            Choose & Plan
          </p>
        </div>
      </div>

      {/* Goal Tabs - Horizontal scroll */}
      <div className="flex overflow-x-auto mb-4 pb-1 scrollbar-hide -mx-1 px-1">
        {GOAL_TYPES.map((goal, index) => (
          <motion.button
            key={goal.id}
            className={`px-3 py-2 mr-2 rounded-xl whitespace-nowrap flex items-center transition-all ${
              activeGoal === goal.id
                ? "bg-purple-600 text-white font-bold shadow-lg shadow-purple-500/20"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold"
            }`}
            onClick={() => handleGoalSelect(goal.id)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <span
              className={
                activeGoal === goal.id
                  ? "mr-1.5 text-base"
                  : "mr-1 text-sm opacity-70"
              }
            >
              {goal.icon}
            </span>
            <span className="text-[10px]">{goal.title}</span>
          </motion.button>
        ))}
      </div>

      {/* Selected Goal Detail */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeGoal}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          {/* Goal Header Card */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/30 dark:from-purple-900/20 dark:to-purple-900/5 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30">
            <div className="flex items-start gap-3 mb-3">
              <motion.div
                className="text-3xl bg-white dark:bg-gray-800 p-2 rounded-xl shadow-sm border border-purple-100 dark:border-purple-800/30"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3,
                }}
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

            {/* Tags - Animated stagger */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {currentGoal.regions.map((region, i) => (
                <motion.span
                  key={region}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50"
                >
                  {region}
                </motion.span>
              ))}
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: currentGoal.regions.length * 0.05 }}
                className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50"
              >
                🥇 {currentGoal.commodityAllocation}% Gold
              </motion.span>
              {currentGoal.chains.map((chain, i) => (
                <motion.span
                  key={chain}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: (currentGoal.regions.length + 1 + i) * 0.05,
                  }}
                  className="inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                >
                  {chain}
                </motion.span>
              ))}
            </div>

            {/* Benefits - Animated list */}
            <div className="space-y-1.5">
              {currentGoal.benefits.map((benefit, idx) => (
                <motion.div
                  key={benefit}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + idx * 0.08 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-emerald-500 text-[10px] mt-0.5 shrink-0">
                    ✓
                  </span>
                  <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 leading-relaxed">
                    {benefit}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Expandable Examples Accordion */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="w-full flex items-center justify-between p-3 bg-gray-900 rounded-xl border border-gray-800 hover:border-purple-500/50 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <span className="text-xs font-black text-white group-hover:text-purple-300 transition-colors">
                  Real-World Examples
                </span>
              </div>
              <motion.div
                animate={{ rotate: showExamples ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg
                  className="w-4 h-4 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </motion.div>
            </button>

            <AnimatePresence>
              {showExamples && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="pt-2 space-y-2">
                    <AnimatePresence mode="popLayout">
                      {currentGoal.examples.map((example, idx) => (
                        <motion.div
                          key={example.title}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ delay: idx * 0.1 }}
                          className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="text-[10px] font-black text-purple-400 uppercase tracking-wide mb-1">
                                {example.title}
                              </div>
                              <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-relaxed">
                                {example.description}
                              </p>
                            </div>
                            <div className="shrink-0 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 rounded-md">
                              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                {example.metric}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Calculator Toggle */}
          <button
            onClick={() => setShowCalculator(!showCalculator)}
            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-purple-200 dark:hover:border-purple-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🧮</span>
              <span className="text-xs font-black text-gray-700 dark:text-gray-300">
                {showCalculator ? "Hide Calculator" : "Calculate Your Plan"}
              </span>
            </div>
            <motion.span
              animate={{ rotate: showCalculator ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-gray-400 text-xs"
            >
              ▼
            </motion.span>
          </button>

          {/* Expandable Calculator */}
          <AnimatePresence>
            {showCalculator && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                  {/* Goal Amount */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">
                      Goal Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-sm">
                        $
                      </span>
                      <input
                        type="number"
                        value={goalAmount}
                        onChange={(e) =>
                          setGoalAmount(Number(e.target.value))
                        }
                        className="w-full pl-7 pr-3 py-2 text-sm border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-black outline-none focus:border-purple-400 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Timeframe */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Timeframe
                      </label>
                      <span className="text-[10px] font-black text-purple-600">
                        {timeframeMonths} months
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="60"
                      value={timeframeMonths}
                      onChange={(e) =>
                        setTimeframeMonths(Number(e.target.value))
                      }
                      className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                  </div>

                  {/* Results */}
                  <div className="grid grid-cols-2 gap-2">
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700"
                    >
                      <div className="text-[9px] font-black uppercase text-gray-400">
                        Monthly
                      </div>
                      <div className="text-lg font-black text-purple-600">
                        $
                        {monthlySavingsNeeded.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-700"
                    >
                      <div className="text-[9px] font-black uppercase text-gray-400">
                        Protected Value
                      </div>
                      <div className="text-lg font-black text-emerald-600">
                        $
                        {estimatedValue.toLocaleString(undefined, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Why It Matters - Footer */}
      <motion.div
        className="mt-4 p-3 bg-gray-900 rounded-xl relative overflow-hidden"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl -mr-10 -mt-10" />
        <p className="text-[10px] font-bold text-gray-300 leading-relaxed relative">
          <span className="text-purple-400 font-black">WHY IT MATTERS</span>{" "}
          · In emerging markets, currencies can lose 10-30% yearly.
          Geographic diversification is the{" "}
          <span className="text-purple-400">ultimate hedge</span>.
        </p>
      </motion.div>
    </div>
  );
}

export { GOAL_TYPES };
