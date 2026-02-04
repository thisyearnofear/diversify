import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Region } from "../../hooks/use-user-region";
import { getRegionDesign } from "../../constants/tokens";

// Geographic allocation recommendations for users based on their home region
interface RegionInsight {
  title: string;
  description: string;
  typicalAllocation: Record<string, number>;
  considerations: string[];
  inflationRate: number;
  volatilityLevel: "Low" | "Medium" | "High";
  localCurrencies: string[];
  recommendedTokens: { symbol: string; percentage: number; reason: string }[];
}

const REGION_INSIGHTS: Record<string, RegionInsight> = {
  Africa: {
    title: "African Market Insights",
    description:
      "Based on historical data, African users benefit significantly from diversifying into EUR and USD stablecoins to address local currency volatility.",
    typicalAllocation: {
      Africa: 40,
      USA: 30,
      Europe: 20,
      Asia: 5,
      LatAm: 5,
    },
    considerations: [
      "African currencies often experience higher inflation rates (avg 11.2%)",
      "EUR and USD provide stability during economic uncertainty",
      "Local currency exposure helps with everyday expenses",
      "A mix of local and global currencies balances needs with stability",
    ],
    inflationRate: 11.2,
    volatilityLevel: "High",
    localCurrencies: ["KESm", "GHSm", "XOFm"],
    recommendedTokens: [
      { symbol: "KESm", percentage: 25, reason: "Local spending" },
      { symbol: "EURm", percentage: 25, reason: "Euro stability" },
      { symbol: "USDm", percentage: 25, reason: "USD hedge" },
      { symbol: "PAXG", percentage: 15, reason: "Inflation hedge" },
      { symbol: "USDY", percentage: 10, reason: "Yield (5% APY)" },
    ],
  },
  USA: {
    title: "US Market Insights",
    description:
      "US-based users typically add exposure to EUR and emerging markets for diversification benefits while maintaining USD as the base.",
    typicalAllocation: {
      USA: 50,
      Europe: 25,
      Asia: 10,
      Africa: 10,
      LatAm: 5,
    },
    considerations: [
      "USD is a global reserve currency with relative stability (3.1% inflation)",
      "EUR provides hedge against USD fluctuations",
      "Emerging market exposure offers different economic cycles",
      "Global diversification can reduce overall portfolio volatility",
    ],
    inflationRate: 3.1,
    volatilityLevel: "Low",
    localCurrencies: ["USDm"],
    recommendedTokens: [
      { symbol: "USDm", percentage: 40, reason: "Primary currency" },
      { symbol: "EURm", percentage: 25, reason: "Diversification" },
      { symbol: "USDY", percentage: 20, reason: "Yield (5% APY)" },
      { symbol: "PAXG", percentage: 10, reason: "Gold hedge" },
      { symbol: "KESm", percentage: 5, reason: "Emerging markets" },
    ],
  },
  Europe: {
    title: "European Market Insights",
    description:
      "European users typically maintain EUR as their base with USD and emerging market exposure for optimal diversification.",
    typicalAllocation: {
      Europe: 50,
      USA: 25,
      Africa: 10,
      Asia: 10,
      LatAm: 5,
    },
    considerations: [
      "EUR provides stability for European residents (2.4% inflation)",
      "USD offers protection against EUR-specific risks",
      "African stablecoins can provide exposure to different markets",
      "Diversification across currencies can reduce overall risk",
    ],
    inflationRate: 2.4,
    volatilityLevel: "Low",
    localCurrencies: ["EURm"],
    recommendedTokens: [
      { symbol: "EURm", percentage: 45, reason: "Primary currency" },
      { symbol: "USDm", percentage: 25, reason: "USD hedge" },
      { symbol: "USDY", percentage: 15, reason: "Yield (5% APY)" },
      { symbol: "KESm", percentage: 10, reason: "Diversification" },
      { symbol: "PAXG", percentage: 5, reason: "Gold hedge" },
    ],
  },
  LatAm: {
    title: "Latin American Market Insights",
    description:
      "In Latin America, users maintain significant USD and EUR allocations alongside local currencies to hedge against inflation.",
    typicalAllocation: {
      LatAm: 35,
      USA: 35,
      Europe: 20,
      Asia: 5,
      Africa: 5,
    },
    considerations: [
      "Latin American currencies often face inflation pressures (5.9% avg)",
      "USD provides stability for savings",
      "Local currency exposure helps with everyday expenses",
      "A balanced approach addresses both local needs and stability",
    ],
    inflationRate: 5.9,
    volatilityLevel: "Medium",
    localCurrencies: ["BRLm", "COPm"],
    recommendedTokens: [
      { symbol: "USDm", percentage: 35, reason: "USD stability" },
      { symbol: "BRLm", percentage: 25, reason: "Local spending" },
      { symbol: "EURm", percentage: 20, reason: "Euro diversification" },
      { symbol: "PAXG", percentage: 15, reason: "Inflation hedge" },
      { symbol: "USDY", percentage: 5, reason: "Yield (5% APY)" },
    ],
  },
  Asia: {
    title: "Asian Market Insights",
    description:
      "Users in Asia often take a balanced approach with significant USD exposure alongside local currencies for regional diversification.",
    typicalAllocation: {
      Asia: 40,
      USA: 30,
      Europe: 20,
      Africa: 5,
      LatAm: 5,
    },
    considerations: [
      "Asian currencies vary widely in stability (3.9% avg inflation)",
      "USD provides stability for savings",
      "EUR offers diversification from USD",
      "A mix of local and global currencies addresses different needs",
    ],
    inflationRate: 3.9,
    volatilityLevel: "Medium",
    localCurrencies: ["PHPm"],
    recommendedTokens: [
      { symbol: "PHPm", percentage: 30, reason: "Local currency" },
      { symbol: "USDm", percentage: 30, reason: "USD stability" },
      { symbol: "EURm", percentage: 20, reason: "Euro diversification" },
      { symbol: "USDY", percentage: 15, reason: "Yield (5% APY)" },
      { symbol: "PAXG", percentage: 5, reason: "Gold hedge" },
    ],
  },
};

interface RegionalRecommendationsProps {
  userRegion: Region;
  currentAllocations?: Record<string, number>;
  onSelectToken?: (token: string) => void;
}

export default function RegionalRecommendations({
  userRegion,
  currentAllocations,
  onSelectToken,
}: RegionalRecommendationsProps) {
  const [selectedRegion, setSelectedRegion] = useState<string>(userRegion);
  const [showConsiderations, setShowConsiderations] = useState(false);
  const regionData = REGION_INSIGHTS[selectedRegion];
  const regionDesign = getRegionDesign(selectedRegion);

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
      totalDifference: totalDifference / 2,
      isClose: totalDifference < 10,
    };
  };

  const difference = currentAllocations ? calculateDifference() : null;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${regionDesign.gradient} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-2xl">
              {regionDesign.icon}
            </div>
            <div>
              <h2 className="text-white font-black text-lg uppercase tracking-tight">
                Regional Insights
              </h2>
              <p className="text-white/70 text-xs">{regionData.title}</p>
            </div>
          </div>
          <span className="text-[10px] text-white/60 bg-black/20 px-2 py-1 rounded-full border border-white/10">
            Data: World Bank
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Region Selector */}
        <div className="flex overflow-x-auto gap-2 pb-2 -mx-4 px-4">
          {Object.keys(REGION_INSIGHTS).map((region) => {
            const design = getRegionDesign(region);
            return (
              <motion.button
                key={region}
                onClick={() => setSelectedRegion(region)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedRegion === region
                    ? `bg-gradient-to-r ${design.gradient} text-white shadow-lg`
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
              >
                <span className="mr-1">{design.icon}</span>
                {region}
              </motion.button>
            );
          })}
        </div>

        {/* Description Card */}
        <div className={`bg-gradient-to-br ${regionDesign.gradient} bg-opacity-10 rounded-xl p-4 border border-gray-200 dark:border-gray-700`}>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {regionData.description}
          </p>

          {/* Stats */}
          <div className="mt-3 flex gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-500 uppercase">Inflation</div>
              <div className={`text-sm font-bold ${regionData.inflationRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
                {regionData.inflationRate}%
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2">
              <div className="text-[10px] text-gray-500 uppercase">Volatility</div>
              <div className={`text-sm font-bold ${regionData.volatilityLevel === 'High' ? 'text-red-600' :
                  regionData.volatilityLevel === 'Medium' ? 'text-amber-600' : 'text-green-600'
                }`}>
                {regionData.volatilityLevel}
              </div>
            </div>
          </div>
        </div>

        {/* Typical Allocation Visualization */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
            <span>📊</span> Typical Allocation Pattern
          </h3>

          {/* Stacked Bar */}
          <div className="flex rounded-lg overflow-hidden mb-3 h-8 shadow-inner">
            {Object.entries(regionData.typicalAllocation).map(([region, allocation]) => {
              const design = getRegionDesign(region);
              return (
                <div
                  key={region}
                  className={`h-full bg-gradient-to-r ${design.gradient}`}
                  style={{ width: `${allocation}%` }}
                  title={`${region}: ${allocation}%`}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(regionData.typicalAllocation).map(([region, allocation]) => {
              const design = getRegionDesign(region);
              return (
                <div key={region} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${design.gradient}`} />
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {design.icon} {allocation}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recommended Token Cards */}
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-sm mb-3 flex items-center gap-2">
            <span>💡</span> Recommended Allocation
          </h3>

          <div className="space-y-2">
            {regionData.recommendedTokens.map((token, index) => (
              <motion.div
                key={token.symbol}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => onSelectToken?.(token.symbol)}
                className="bg-white dark:bg-gray-800 rounded-xl p-3 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xl text-white">
                      {token.symbol === 'PAXG' ? '🥇' :
                        token.symbol === 'USDY' ? '💰' :
                          token.symbol === 'SYRUPUSDC' ? '🍯' :
                            token.symbol.startsWith('c') ? '💵' : '💎'}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white">{token.symbol}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{token.reason}</p>
                    </div>
                  </div>
                  <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold px-3 py-1 rounded-full">
                    {token.percentage}%
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Portfolio Comparison */}
        <AnimatePresence mode="wait">
          {difference && (
            <motion.div
              key={difference.isClose ? 'close' : 'diff'}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`rounded-xl p-4 border ${difference.isClose
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${difference.isClose ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                  }`}>
                  {difference.isClose ? '✓' : '⚠️'}
                </div>
                <div>
                  <h4 className={`font-bold ${difference.isClose ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}`}>
                    {difference.isClose ? 'Well Aligned' : 'Adjustment Opportunity'}
                  </h4>
                  <p className={`text-xs ${difference.isClose ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    {difference.isClose
                      ? 'Your portfolio matches regional patterns'
                      : `${difference.totalDifference.toFixed(0)}% difference from typical`}
                  </p>
                </div>
              </div>

              {!difference.isClose && (
                <div className="space-y-1 mt-3">
                  {Object.entries(difference.differences)
                    .filter(([, diff]) => Math.abs(diff) >= 5)
                    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                    .slice(0, 3)
                    .map(([region, diff]) => {
                      const design = getRegionDesign(region);
                      return (
                        <div key={region} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span>{design.icon}</span>
                            <span className="text-gray-700 dark:text-gray-300">{region}</span>
                          </div>
                          <span className={diff > 0 ? 'text-amber-600 font-bold' : 'text-green-600 font-bold'}>
                            {diff > 0 ? `+${diff.toFixed(0)}% needed` : `${Math.abs(diff).toFixed(0)}% excess`}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Considerations Accordion */}
        <motion.button
          onClick={() => setShowConsiderations(!showConsiderations)}
          className="w-full p-3 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-gray-900 dark:text-white text-sm">
              🤔 Key Considerations
            </span>
            <motion.span
              animate={{ rotate: showConsiderations ? 180 : 0 }}
              className="text-gray-600 dark:text-gray-400"
            >
              ▼
            </motion.span>
          </div>

          <AnimatePresence>
            {showConsiderations && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <ul className="mt-3 space-y-2 text-left">
                  {regionData.considerations.map((consideration, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>{consideration}</span>
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
