import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AIAdvice } from '../../hooks/use-diversifi-ai';
import { getTokenDesign } from '../../constants/tokens';

interface InteractiveAdviceCardProps {
    advice: AIAdvice;
    onSelectAlternative: (alternative: AIAdvice) => void;
    onExecute: (token: string, amount?: number) => void;
}

export default function InteractiveAdviceCard({ advice, onSelectAlternative, onExecute }: InteractiveAdviceCardProps) {
    const [expandedSection, setExpandedSection] = useState<string | null>(null);
    const [selectedPercentage, setSelectedPercentage] = useState(100);
    const [showAlternatives, setShowAlternatives] = useState(false);
    const [selectedAlternative, setSelectedAlternative] = useState<AIAdvice | null>(null);

    const toggleSection = (section: string) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const calculateAmount = (baseAmount: number, percentage: number) => {
        return (baseAmount * percentage) / 100;
    };


    const getRiskBadgeColor = (risk: 'LOW' | 'MEDIUM' | 'HIGH') => {
        switch (risk) {
            case 'LOW': return 'bg-green-600 text-white';
            case 'MEDIUM': return 'bg-amber-600 text-white';
            case 'HIGH': return 'bg-red-600 text-white';
        }
    };

    return (
        <div className="space-y-4">
            {/* Primary Recommendation */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-blue-500 shadow-xl overflow-hidden"
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">⭐</span>
                            <div>
                                <h3 className="text-white font-black text-sm uppercase tracking-tight">Top Recommendation</h3>
                                <p className="text-blue-100 text-xs font-medium">AI-Optimized Choice</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold px-3 py-1 rounded-full ${getRiskBadgeColor(advice.riskLevel || 'MEDIUM')}`}>
                                {advice.riskLevel}
                            </span>
                            <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/30">
                                <span className="text-xs font-black text-white">{(advice.confidence * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-4">
                    {/* Main Action */}
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                        <div>
                            <span className="text-xs text-blue-600 dark:text-blue-400 font-medium uppercase tracking-wide">
                                {advice.action}
                            </span>
                            <h4 className="text-lg font-black text-gray-900 dark:text-white">
                                {advice.targetToken}
                            </h4>
                            {advice.expectedSavings && (
                                <p className="text-xs text-green-600 dark:text-green-400 font-bold mt-1">
                                    Save ${advice.expectedSavings.toFixed(2)}/year
                                </p>
                            )}
                        </div>
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getTokenDesign(advice.targetToken || '').gradient} shadow-lg flex items-center justify-center text-4xl ${getTokenDesign(advice.targetToken || '').shadowColor}`}>
                            {getTokenDesign(advice.targetToken || '').icon}
                        </div>
                    </div>

                    {/* AI Reasoning */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="mb-2">
                            <h5 className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">
                                Strategy
                            </h5>
                            <p className="text-sm font-black text-gray-900 dark:text-white leading-tight">
                                {advice.oneLiner}
                            </p>
                        </div>
                        <p className="text-xs text-gray-700 dark:text-gray-400 font-medium leading-relaxed italic">
                            &quot;{advice.reasoning}&quot;
                        </p>

                        {/* Data Freshness Indicator */}
                        {advice.portfolioAnalysis && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                                <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <span>📊</span>
                                        <span>
                                            Data: {advice.portfolioAnalysis.dataSource === 'imf' ? 'IMF (Live 2024)' :
                                                advice.portfolioAnalysis.dataSource === 'worldbank' ? 'World Bank (2024)' :
                                                    'Market Data (Cached)'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <span>🌍</span>
                                            {advice.portfolioAnalysis.regionCount || 0} regions
                                        </span>
                                        <span className={`flex items-center gap-1 ${advice.confidence > 0.8 ? 'text-green-600' :
                                            advice.confidence > 0.6 ? 'text-amber-600' : 'text-gray-500'
                                            }`}>
                                            <span>✓</span>
                                            {advice.confidence > 0.8 ? 'High Confidence' :
                                                advice.confidence > 0.6 ? 'Medium Confidence' : 'Estimated'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Amount Slider (ENHANCEMENT: percentage-based swaps) */}
                    {advice.suggestedAmount && (
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-100 uppercase tracking-wide">
                                    Swap Amount
                                </span>
                                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                                    ${calculateAmount(advice.suggestedAmount, selectedPercentage).toFixed(2)}
                                </span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="25"
                                value={selectedPercentage}
                                onChange={(e) => setSelectedPercentage(Number(e.target.value))}
                                className="w-full h-2 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <div className="flex justify-between mt-2">
                                {[25, 50, 75, 100].map((pct) => (
                                    <button
                                        key={pct}
                                        onClick={() => setSelectedPercentage(pct)}
                                        className={`text-xs font-bold px-3 py-1 rounded-full transition-all ${selectedPercentage === pct
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                                            }`}
                                    >
                                        {pct}%
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Expandable Reasoning Sections (ENHANCEMENT: interactive Q&A) */}
                    {advice.expandableReasoning && (
                        <div className="space-y-2">
                            <h5 className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">
                                💬 Have Questions?
                            </h5>

                            {/* Why This? */}
                            <motion.button
                                onClick={() => toggleSection('why')}
                                className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all shadow-sm"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-blue-500">🤔</span>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                                            Why this recommendation?
                                        </span>
                                    </div>
                                    <motion.span
                                        animate={{ rotate: expandedSection === 'why' ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="text-gray-400"
                                    >
                                        ▼
                                    </motion.span>
                                </div>
                                <AnimatePresence>
                                    {expandedSection === 'why' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                                                {advice.expandableReasoning.whyThis}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.button>

                            {/* How We Calculated This (NEW) */}
                            {advice.portfolioAnalysis?.topOpportunity && (
                                <motion.button
                                    onClick={() => toggleSection('calculation')}
                                    className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600 transition-all shadow-sm"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-500">🔍</span>
                                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                How we calculated this
                                            </span>
                                        </div>
                                        <motion.span
                                            animate={{ rotate: expandedSection === 'calculation' ? 180 : 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="text-gray-400"
                                        >
                                            ▼
                                        </motion.span>
                                    </div>
                                    <AnimatePresence>
                                        {expandedSection === 'calculation' && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800/30">
                                                    <div className="space-y-2 text-[11px] font-mono text-gray-600 dark:text-gray-400">
                                                        <div className="flex justify-between">
                                                            <span>{advice.portfolioAnalysis.topOpportunity.fromRegion || advice.portfolioAnalysis.topOpportunity.fromToken || 'Current'} Inflation:</span>
                                                            <span className="font-bold text-red-500">{advice.portfolioAnalysis.topOpportunity.fromInflation || 'N/A'}%</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{advice.portfolioAnalysis.topOpportunity.toRegion || advice.portfolioAnalysis.topOpportunity.toToken || 'Target'} Inflation:</span>
                                                            <span className="font-bold text-green-500">{advice.portfolioAnalysis.topOpportunity.toInflation || 'N/A'}%</span>
                                                        </div>
                                                        <div className="border-t border-green-200 dark:border-green-800/50 my-1 pt-1 flex justify-between">
                                                            <span>Inflation Delta:</span>
                                                            <span className="font-bold text-blue-500">{((advice.portfolioAnalysis.topOpportunity.fromInflation || 0) - (advice.portfolioAnalysis.topOpportunity.toInflation || 0)).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Investment Amount:</span>
                                                            <span className="font-bold text-gray-900 dark:text-gray-200">${advice.suggestedAmount?.toFixed(0) || '0'}</span>
                                                        </div>
                                                        <div className="border-t-2 border-green-300 dark:border-green-700 my-1 pt-2 flex justify-between text-xs">
                                                            <span className="font-black">Annual Savings:</span>
                                                            <span className="font-black text-green-600 dark:text-green-400">
                                                                ${advice.portfolioAnalysis.topOpportunity.annualSavings?.toFixed(2) || advice.expectedSavings?.toFixed(2) || '0.00'}/year
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] font-sans italic mt-2 text-gray-400">
                                                            * Calculation: Amount × (Current Inflation - Target Inflation) = Annual Purchasing Power Preserved
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.button>
                            )}

                            {/* Show Risks */}
                            <motion.button
                                onClick={() => toggleSection('risks')}
                                className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-600 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                        ⚠️ What are the risks?
                                    </span>
                                    <motion.span
                                        animate={{ rotate: expandedSection === 'risks' ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        ▼
                                    </motion.span>
                                </div>
                                <AnimatePresence>
                                    {expandedSection === 'risks' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <ul className="text-xs text-gray-600 dark:text-gray-400 mt-2 space-y-1">
                                                {advice.expandableReasoning.risks.map((risk, idx) => (
                                                    <li key={idx} className="flex items-start gap-2">
                                                        <span className="text-amber-500 mt-0.5">•</span>
                                                        <span>{risk}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.button>

                            {/* Timing */}
                            <motion.button
                                onClick={() => toggleSection('timing')}
                                className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                        ⏰ Why now?
                                    </span>
                                    <motion.span
                                        animate={{ rotate: expandedSection === 'timing' ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        ▼
                                    </motion.span>
                                </div>
                                <AnimatePresence>
                                    {expandedSection === 'timing' && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                                                {advice.expandableReasoning.timing}
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.button>
                        </div>
                    )}

                    {/* Execute Button */}
                    <motion.button
                        onClick={() => onExecute(advice.targetToken!, advice.suggestedAmount ? calculateAmount(advice.suggestedAmount, selectedPercentage) : undefined)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-xl font-black text-sm uppercase tracking-wider shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2"
                    >
                        <span>Execute {advice.action}</span>
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </motion.button>
                </div>
            </motion.div>

            {/* Alternatives Section (ENHANCEMENT: compare and choose) */}
            {advice.alternatives && advice.alternatives.length > 0 && (
                <div className="space-y-3">
                    <button
                        onClick={() => setShowAlternatives(!showAlternatives)}
                        className="w-full p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">🔀</span>
                                <span className="text-sm font-bold text-purple-900 dark:text-purple-100">
                                    View {advice.alternatives.length} Alternative{advice.alternatives.length > 1 ? 's' : ''}
                                </span>
                            </div>
                            <motion.span
                                animate={{ rotate: showAlternatives ? 180 : 0 }}
                                className="text-purple-600 dark:text-purple-400"
                            >
                                ▼
                            </motion.span>
                        </div>
                    </button>

                    <AnimatePresence>
                        {showAlternatives && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="space-y-3 overflow-hidden"
                            >
                                {advice.alternatives.map((alt, idx) => (
                                    <motion.div
                                        key={alt.token}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedAlternative?.token === alt.token
                                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 shadow-lg'
                                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-purple-300 dark:hover:border-purple-600'
                                            }`}
                                        onClick={() => setSelectedAlternative(selectedAlternative?.token === alt.token ? null : alt)}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getTokenDesign(alt.token || '').gradient} flex items-center justify-center text-xl ${getTokenDesign(alt.token || '').shadowColor}`}>
                                                    {getTokenDesign(alt.token || '').icon}
                                                </span>
                                                <div>
                                                    <h4 className="text-lg font-black text-gray-900 dark:text-white">{alt.token}</h4>
                                                    {alt.apy && (
                                                        <p className="text-xs text-green-600 dark:text-green-400 font-bold">
                                                            {alt.apy}% APY
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {alt.riskLevel && (
                                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${getRiskBadgeColor(alt.riskLevel)}`}>
                                                    {alt.riskLevel}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                                            {alt.reasoning}
                                        </p>

                                        {/* Comparison vs Primary */}
                                        {alt.comparisonVsPrimary && (
                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                                                    <div className="text-[10px] text-gray-500 uppercase">Savings</div>
                                                    <div className={`text-xs font-bold ${alt.comparisonVsPrimary.savingsDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {alt.comparisonVsPrimary.savingsDiff >= 0 ? '+' : ''}{alt.comparisonVsPrimary.savingsDiff.toFixed(0)}
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                                                    <div className="text-[10px] text-gray-500 uppercase">Risk</div>
                                                    <div className={`text-xs font-bold ${alt.comparisonVsPrimary.riskDiff === 'LOWER' ? 'text-green-600' :
                                                        alt.comparisonVsPrimary.riskDiff === 'HIGHER' ? 'text-red-600' : 'text-gray-600'
                                                        }`}>
                                                        {alt.comparisonVsPrimary.riskDiff}
                                                    </div>
                                                </div>
                                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
                                                    <div className="text-[10px] text-gray-500 uppercase">Liquid</div>
                                                    <div className={`text-xs font-bold ${alt.comparisonVsPrimary.liquidityDiff === 'BETTER' ? 'text-green-600' :
                                                        alt.comparisonVsPrimary.liquidityDiff === 'WORSE' ? 'text-red-600' : 'text-gray-600'
                                                        }`}>
                                                        {alt.comparisonVsPrimary.liquidityDiff}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Pros & Cons */}
                                        {(alt.pros || alt.cons) && (
                                            <div className="grid grid-cols-2 gap-3 mb-3">
                                                {alt.pros && (
                                                    <div>
                                                        <div className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase mb-1">Pros</div>
                                                        <ul className="space-y-1">
                                                            {alt.pros.slice(0, 2).map((pro, i) => (
                                                                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                                                                    <span className="text-green-500">✓</span>
                                                                    <span className="flex-1">{pro}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {alt.cons && (
                                                    <div>
                                                        <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase mb-1">Cons</div>
                                                        <ul className="space-y-1">
                                                            {alt.cons.slice(0, 2).map((con, i) => (
                                                                <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1">
                                                                    <span className="text-red-500">×</span>
                                                                    <span className="flex-1">{con}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Choose This Alternative */}
                                        <motion.button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectAlternative(alt);
                                            }}
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                                        >
                                            Choose This Instead
                                        </motion.button>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
