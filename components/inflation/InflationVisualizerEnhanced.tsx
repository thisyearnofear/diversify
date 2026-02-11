import React, { useState } from "react";
import type { Region } from "@/hooks/use-user-region";
import { RegionalPattern } from "../regional/RegionalIconography";
import { motion } from "framer-motion";

interface InflationVisualizerProps {
    region: Region;
    inflationRate: number;
    years?: number;
    initialAmount?: number;
    safeHavenYield?: number;
    interactive?: boolean;
}

/**
 * ENHANCED: Interactive, colorful, engaging visualization
 * Shows inflation's devastating impact vs safe haven protection
 */
export default function InflationVisualizerEnhanced({
    region,
    inflationRate,
    years = 5,
    initialAmount = 100,
    safeHavenYield = 5.2,
    interactive = true,
}: InflationVisualizerProps) {
    const [amount, setAmount] = useState(initialAmount);
    const [hoveredYear, setHoveredYear] = useState<number | null>(null);

    const activeAmount = interactive ? amount : initialAmount;

    // Calculate cash erosion over time
    const cashValueOverTime = Array.from({ length: years + 1 }, (_, i) => {
        const value = activeAmount * Math.pow(1 - inflationRate / 100, i);
        return {
            year: i,
            value: Math.round(value * 100) / 100,
            percentage: Math.round((value / activeAmount) * 100),
            loss: activeAmount - value,
        };
    });

    // Calculate safe haven growth
    const safeHavenValueOverTime = Array.from({ length: years + 1 }, (_, i) => {
        const value = activeAmount * Math.pow(1 + safeHavenYield / 100, i);
        return {
            year: i,
            value: Math.round(value * 100) / 100,
            gain: value - activeAmount,
        };
    });

    const totalLoss = activeAmount - cashValueOverTime[years].value;
    const wealthPreserved = safeHavenValueOverTime[years].value - cashValueOverTime[years].value;
    const percentageLost = ((totalLoss / activeAmount) * 100).toFixed(1);

    const displayYear = hoveredYear !== null ? hoveredYear : years;
    const displayCash = cashValueOverTime[displayYear];
    const displaySafe = safeHavenValueOverTime[displayYear];

    return (
        <div className="relative overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 dark:from-gray-900 dark:via-blue-900/10 dark:to-purple-900/10 rounded-2xl shadow-2xl p-6 border-2 border-blue-100 dark:border-blue-900">
            <RegionalPattern region={region} />

            <div className="relative z-10">
                {/* HEADER with Interactive Input */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="font-black text-gray-900 dark:text-white text-xl tracking-tight uppercase mb-1">
                            💰 Wealth Protection Calculator
                        </h3>
                        <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                            See how inflation destroys your savings over time
                        </p>
                    </div>

                    {interactive && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-lg border-2 border-blue-200 dark:border-blue-700">
                            <label className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase block mb-1">
                                Your Amount
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-gray-900 dark:text-white">$</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
                                    className="w-24 text-xl font-black text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:border-blue-600 outline-none"
                                    min="1"
                                    max="1000000"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* KEY STATS - Big, Bold, Emotional */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-gradient-to-br from-red-500 to-orange-600 rounded-2xl p-4 text-white shadow-xl"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">📉</span>
                            <span className="text-xs font-black uppercase opacity-90">Inflation Loss</span>
                        </div>
                        <div className="text-3xl font-black mb-1">-${totalLoss.toFixed(0)}</div>
                        <div className="text-xs font-bold opacity-90">
                            {percentageLost}% gone in {years} years
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-xl"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">🛡️</span>
                            <span className="text-xs font-black uppercase opacity-90">Protected Gain</span>
                        </div>
                        <div className="text-3xl font-black mb-1">+${wealthPreserved.toFixed(0)}</div>
                        <div className="text-xs font-bold opacity-90">
                            With safe haven strategy
                        </div>
                    </motion.div>
                </div>

                {/* INTERACTIVE TIMELINE */}
                <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl p-4 mb-6 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <span className="text-xs font-black text-gray-400 uppercase">Year {displayYear}</span>
                            <div className="flex items-center gap-4 mt-1">
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Cash:</span>
                                    <span className="text-lg font-black text-red-600 dark:text-red-400 ml-2">
                                        ${displayCash.value.toFixed(0)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">Protected:</span>
                                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 ml-2">
                                        ${displaySafe.value.toFixed(0)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Difference</span>
                            <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
                                ${(displaySafe.value - displayCash.value).toFixed(0)}
                            </div>
                        </div>
                    </div>

                    {/* Interactive Year Markers */}
                    <div className="flex items-end justify-between h-24 mb-2">
                        {cashValueOverTime.map((data, i) => {
                            const cashHeight = (data.percentage / 100) * 80;
                            const safeHeight = ((safeHavenValueOverTime[i].value / activeAmount) * 100 / 100) * 80;

                            return (
                                <motion.button
                                    key={i}
                                    onHoverStart={() => setHoveredYear(i)}
                                    onHoverEnd={() => setHoveredYear(null)}
                                    className="flex-1 flex flex-col items-center cursor-pointer group"
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    {/* Safe Haven Bar (Green) */}
                                    <div className="relative w-full px-0.5">
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${Math.min(safeHeight, 80)}px` }}
                                            transition={{ duration: 0.5, delay: i * 0.1 }}
                                            className={`w-full bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t-lg ${hoveredYear === i ? 'ring-2 ring-emerald-400' : ''
                                                }`}
                                        />
                                        {/* Cash Bar (Red) - Overlaid */}
                                        <motion.div
                                            initial={{ height: 0 }}
                                            animate={{ height: `${cashHeight}px` }}
                                            transition={{ duration: 0.5, delay: i * 0.1 + 0.2 }}
                                            className={`absolute bottom-0 left-0 right-0 mx-0.5 bg-gradient-to-t from-red-500 to-orange-400 rounded-t-lg opacity-80 ${hoveredYear === i ? 'ring-2 ring-red-400' : ''
                                                }`}
                                        />
                                    </div>

                                    <span className={`text-xs font-bold mt-2 ${hoveredYear === i
                                            ? 'text-blue-600 dark:text-blue-400'
                                            : 'text-gray-400'
                                        }`}>
                                        {i}
                                    </span>
                                </motion.button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gradient-to-br from-emerald-500 to-teal-400 rounded" />
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Protected (RWA)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-gradient-to-br from-red-500 to-orange-400 rounded opacity-80" />
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-400">Cash Erosion</span>
                        </div>
                    </div>
                </div>

                {/* IMPACT SUMMARY - Dramatic */}
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.8 }}
                    className="relative bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 rounded-2xl p-6 overflow-hidden shadow-2xl"
                >
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -ml-32 -mb-32" />

                    <div className="relative flex items-center gap-4">
                        <div className="flex-shrink-0 size-16 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl flex items-center justify-center text-3xl shadow-xl">
                            🛡️
                        </div>
                        <div className="flex-1">
                            <h4 className="text-emerald-400 font-black text-sm uppercase tracking-widest mb-2">
                                💡 Protection Outcome
                            </h4>
                            <p className="text-white font-bold text-base leading-tight">
                                By diversifying into <span className="text-emerald-400">tokenized assets (PAXG, USDY)</span>,
                                you preserve <span className="text-2xl font-black text-emerald-400">${wealthPreserved.toFixed(0)}</span> in
                                wealth that would otherwise be lost to inflation.
                            </p>
                            <div className="mt-3 flex items-center gap-2">
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min((wealthPreserved / (activeAmount * 2)) * 100, 100)}%` }}
                                        transition={{ duration: 1, delay: 1 }}
                                        className="h-full bg-gradient-to-r from-emerald-400 to-teal-500"
                                    />
                                </div>
                                <span className="text-xs font-black text-emerald-400">
                                    {((wealthPreserved / activeAmount) * 100).toFixed(0)}% gain
                                </span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
