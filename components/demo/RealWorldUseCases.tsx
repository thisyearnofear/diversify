import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

// ============================================================================
// GOAL DEFINITIONS - Single source of truth
// ============================================================================
const GOAL_TYPES = [
  {
    id: "education",
    title: "Education Fund",
    shortTitle: "Education",
    description: "Save for international education expenses with inflation protection",
    icon: "🎓",
    color: "blue",
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
    shortTitle: "Travel",
    description: "Save for international travel with stable purchasing power",
    icon: "✈️",
    color: "cyan",
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
    shortTitle: "Remittance",
    description: "Optimize cross-border transfers with multichain efficiency",
    icon: "💸",
    color: "emerald",
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
    shortTitle: "Business",
    description: "Hedge operational costs and supply chain inflation",
    icon: "🏭",
    color: "amber",
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
    shortTitle: "Emergency",
    description: "Build a crisis-resistant safety net with real asset backing",
    icon: "🛡️",
    color: "rose",
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

const colorMap: Record<string, string> = {
  blue: "from-blue-500 to-indigo-600 shadow-blue-500/20 text-blue-600",
  cyan: "from-cyan-500 to-blue-600 shadow-cyan-500/20 text-cyan-600",
  emerald: "from-emerald-500 to-teal-600 shadow-emerald-500/20 text-emerald-600",
  amber: "from-amber-500 to-orange-600 shadow-amber-500/20 text-amber-600",
  rose: "from-rose-500 to-red-600 shadow-rose-500/20 text-rose-600",
  purple: "from-purple-500 to-violet-600 shadow-purple-500/20 text-purple-600",
};

const bgLightMap: Record<string, string> = {
  blue: "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30",
  cyan: "bg-cyan-50 dark:bg-cyan-900/10 border-cyan-100 dark:border-cyan-800/30",
  emerald: "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800/30",
  amber: "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30",
  rose: "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30",
  purple: "bg-purple-50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-800/30",
};

export default function RealWorldUseCases({
  onSelectGoal,
}: RealWorldUseCasesProps) {
  const [activeGoal, setActiveGoal] = useState<string>("education");
  const [goalAmount, setGoalAmount] = useState<number>(10000);
  const [timeframeMonths, setTimeframeMonths] = useState<number>(36);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const currentGoal =
    GOAL_TYPES.find((goal) => goal.id === activeGoal) || GOAL_TYPES[0];

  const monthlySavingsNeeded = goalAmount / timeframeMonths;
  const estimatedValue = goalAmount * (1 + (0.03 * timeframeMonths) / 12);

  const handleGoalSelect = (goalId: string) => {
    if (goalId === activeGoal) return;
    
    setIsAnimating(true);
    const goal = GOAL_TYPES.find((g) => g.id === goalId);
    if (goal) {
      setTimeout(() => {
        setActiveGoal(goalId);
        setGoalAmount(goal.defaultAmount);
        setTimeframeMonths(goal.defaultTimeframe);
        onSelectGoal?.(goalId);
        setIsAnimating(false);
      }, 200);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl shadow-purple-500/5 border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Visual Header Banner */}
      <div className="relative h-24 bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 px-6 flex items-center overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-400/10 rounded-full blur-2xl -ml-10 -mb-10" />
        
        <div className="relative flex items-center gap-4">
          <motion.div 
            className="size-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-white/30"
            whileHover={{ rotate: [0, -10, 10, 0] }}
          >
            💡
          </motion.div>
          <div>
            <h3 className="text-white font-black text-lg tracking-tight leading-tight">
              Wealth Goals
            </h3>
            <p className="text-purple-100/70 text-xs font-bold uppercase tracking-widest">
              Protect your purchasing power
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Interactive Goal Grid */}
        <div className="grid grid-cols-5 gap-2">
          {GOAL_TYPES.map((goal, index) => {
            const isActive = activeGoal === goal.id;
            return (
              <motion.button
                key={goal.id}
                onClick={() => handleGoalSelect(goal.id)}
                className="relative group"
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <div 
                  className={`flex flex-col items-center p-2 rounded-2xl transition-all duration-300 border ${
                    isActive 
                      ? `bg-white dark:bg-gray-700 border-purple-200 dark:border-purple-500 shadow-lg shadow-purple-500/10 scale-105 z-10` 
                      : `bg-gray-50/50 dark:bg-gray-800/50 border-transparent hover:bg-white dark:hover:bg-gray-700 hover:border-gray-200 dark:hover:border-gray-600`
                  }`}
                >
                  <span className={`text-xl mb-1 transition-transform duration-500 ${isActive ? 'scale-110 rotate-12' : 'group-hover:scale-110'}`}>
                    {goal.icon}
                  </span>
                  <span className={`text-[9px] font-black uppercase tracking-tighter ${isActive ? 'text-purple-600 dark:text-purple-400' : 'text-gray-400 dark:text-gray-500'}`}>
                    {goal.shortTitle}
                  </span>
                  
                  {isActive && (
                    <motion.div 
                      layoutId="activeIndicator"
                      className="absolute -bottom-1 w-6 h-1 bg-purple-600 dark:bg-purple-400 rounded-full"
                    />
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Dynamic Content Area */}
        <div className="min-h-[320px] flex flex-col">
          <AnimatePresence mode="wait">
            {!isAnimating && (
              <motion.div
                key={activeGoal}
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.02, y: -10 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                className="flex-1 flex flex-col"
              >
                {/* Visual Strategy Card */}
                <div className={`p-4 rounded-2xl border ${bgLightMap[currentGoal.color]} transition-colors duration-500 mb-4 overflow-hidden relative group`}>
                   <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                     <span className="text-6xl">{currentGoal.icon}</span>
                   </div>

                  <div className="relative flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`size-2 rounded-full animate-ping bg-${currentGoal.color}-500`} />
                      <h4 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                        {currentGoal.title}
                      </h4>
                    </div>
                    
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium leading-relaxed mb-4 max-w-[90%]">
                      {currentGoal.description}
                    </p>

                    {/* Stats Pill Row */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {currentGoal.regions.map((region) => (
                        <div key={region} className="px-2 py-1 bg-white dark:bg-gray-800 rounded-lg text-[9px] font-black text-gray-500 border border-gray-100 dark:border-gray-700 shadow-sm">
                          🌍 {region}
                        </div>
                      ))}
                      <div className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-[9px] font-black text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 shadow-sm">
                        🥇 {currentGoal.commodityAllocation}% GOLD
                      </div>
                    </div>

                    {/* Smart Logic List */}
                    <div className="grid gap-2">
                      {currentGoal.benefits.map((benefit, idx) => (
                        <motion.div
                          key={benefit}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + idx * 0.1 }}
                          className="flex items-center gap-2"
                        >
                          <div className={`size-4 rounded-full flex items-center justify-center bg-white dark:bg-gray-800 text-[8px] border border-gray-100 dark:border-gray-700 text-emerald-500 shadow-sm`}>
                            ✓
                          </div>
                          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                            {benefit}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Micro-examples Carousel/Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {currentGoal.examples.map((example, idx) => (
                    <motion.div
                      key={example.title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + idx * 0.1 }}
                      className="bg-gray-900 rounded-2xl p-3 border border-gray-800 flex flex-col justify-between"
                    >
                      <div>
                        <div className="text-[9px] font-black text-purple-400 uppercase tracking-widest mb-1.5 flex justify-between">
                          <span>{example.title}</span>
                          <span className="text-emerald-400">●</span>
                        </div>
                        <p className="text-[9px] text-gray-400 font-medium leading-snug">
                          {example.description}
                        </p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-800 flex items-center justify-between">
                        <span className="text-[10px] font-black text-white">{example.metric}</span>
                        <div className="size-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <svg className="size-2 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Action Section */}
                <div className="mt-auto space-y-3">
                  <motion.button
                    onClick={() => setShowCalculator(!showCalculator)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${
                      showCalculator 
                        ? 'bg-purple-600 border-purple-500 shadow-lg shadow-purple-600/20' 
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm ${showCalculator ? 'opacity-100' : 'opacity-70'}`}>🧮</span>
                      <span className={`text-xs font-black uppercase tracking-tight ${showCalculator ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                        {showCalculator ? "Closing Calculator" : "Interactive Planner"}
                      </span>
                    </div>
                    <motion.div
                      animate={{ rotate: showCalculator ? 180 : 0, color: showCalculator ? "#ffffff" : "#9ca3af" }}
                      className="text-xs"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </motion.div>
                  </motion.button>

                  <AnimatePresence>
                    {showCalculator && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ opacity: 1, height: "auto", scale: 1 }}
                        exit={{ opacity: 0, height: 0, scale: 0.95 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Goal (USD)</label>
                              <div className="relative group">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">$</span>
                                <input
                                  type="number"
                                  value={goalAmount}
                                  onChange={(e) => setGoalAmount(Number(e.target.value))}
                                  className="w-full pl-6 pr-3 py-2 text-sm border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-black outline-none focus:border-purple-400 transition-all"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Months</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="range"
                                  min="1"
                                  max="60"
                                  value={timeframeMonths}
                                  onChange={(e) => setTimeframeMonths(Number(e.target.value))}
                                  className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-purple-600"
                                />
                                <span className="text-[10px] font-black text-purple-600 w-6">{timeframeMonths}</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                              <div className="text-[8px] font-black uppercase text-gray-400 mb-1">Monthly Goal</div>
                              <div className="text-base font-black text-purple-600">${monthlySavingsNeeded.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
                              <div className="text-[8px] font-black uppercase text-gray-400 mb-1">Protected Value</div>
                              <div className="text-base font-black text-emerald-600">${estimatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Insight Banner */}
      <div className="p-4 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-start gap-3">
          <div className="shrink-0 size-8 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
             </svg>
          </div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 leading-normal">
            <span className="text-gray-900 dark:text-white font-black uppercase tracking-tighter mr-1">Insider Insight:</span>
            In emerging markets, local currencies lose <span className="text-purple-600 dark:text-purple-400">10-30% yearly</span>. 
            Diversification isn't just a strategy; it's the ultimate hedge.
          </p>
        </div>
      </div>
    </div>
  );
}

export { GOAL_TYPES };
