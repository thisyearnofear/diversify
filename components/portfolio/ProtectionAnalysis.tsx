import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PrimaryButton } from '../shared/TabComponents';
import SimplePieChart from './SimplePieChart';
import NetworkSwitcher from '../swap/NetworkSwitcher';
import sdk from '@farcaster/miniapp-sdk';
import { useAnimatedCounter } from '../../hooks/use-animated-counter';
import type { PortfolioYieldSummary, AssetYieldInfo } from '../../hooks/use-portfolio-yield';

interface ProtectionAnalysisProps {
    regionData: Array<{ region: string; value: number; color: string }>;
    totalValue: number;
    goalScores: {
        hedge: number;
        diversify: number;
        rwa: number;
    };
    diversificationScore: number;
    diversificationRating: string;
    onOptimize: () => void;
    onSwap: () => void;
    chainId?: number | null;
    onNetworkChange?: () => Promise<void>;
    refreshBalances?: () => Promise<void>;
    yieldSummary?: PortfolioYieldSummary;
}

// Grade explanations for user education
const GRADE_EXPLANATIONS: Record<string, Record<string, string>> = {
    hedge: {
        'A+': 'Excellent inflation protection across multiple regions',
        'A': 'Strong hedge with good regional diversification',
        'B+': 'Good hedge, consider adding more emerging market exposure',
        'B': 'Moderate protection, increase non-USD allocation',
        'C+': 'Limited hedge, add Africa/Asia exposure recommended',
        'C': 'Weak inflation protection, rebalance urgently',
        'D': 'No meaningful hedge, portfolio at risk',
    },
    diversify: {
        'A+': 'Outstanding geographic spread across 5+ regions',
        'A': 'Well diversified across multiple continents',
        'B+': 'Good diversification, add 1-2 more regions',
        'B': 'Moderate spread, consider LatAm or Asia',
        'C+': 'Limited diversity, heavy concentration risk',
        'C': 'Poor diversification, rebalance recommended',
        'D': 'Highly concentrated, immediate action needed',
    },
    rwa: {
        'A+': 'Optimal real-world asset exposure (10-15%)',
        'A': 'Strong RWA allocation with good commodities mix',
        'B+': 'Good RWA exposure, consider adding 2-3% more',
        'B': 'Moderate real asset exposure, room to grow',
        'C+': 'Limited RWA, add commodities or real estate tokens',
        'C': 'Insufficient real-world asset protection',
        'D': 'No RWA exposure, portfolio vulnerable to fiat risk',
    },
};

export default function ProtectionAnalysis({
    regionData,
    totalValue,
    goalScores,
    diversificationScore,
    diversificationRating,
    onOptimize,
    onSwap,
    chainId,
    refreshBalances,
    yieldSummary
}: ProtectionAnalysisProps) {
    const [showAmounts, setShowAmounts] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showYieldBreakdown, setShowYieldBreakdown] = useState(false);
    const [highlightedRegionIndex, setHighlightedRegionIndex] = useState<number | null>(null);
    const [expandedGrade, setExpandedGrade] = useState<string | null>(null);
    const [showGrades, setShowGrades] = useState(false);

    // Animated counter for diversification score
    const { formattedValue: animatedScore, isComplete: scoreAnimationComplete } = useAnimatedCounter({
        target: diversificationScore,
        duration: 800,
        easing: 'easeOut',
    });

    const handleRefresh = async () => {
        if (!refreshBalances) return;
        setIsRefreshing(true);
        try {
            await refreshBalances();
        } finally {
            setIsRefreshing(false);
        }
    };

    const getLetterRating = (score: number) => {
        if (score >= 90) return 'A+';
        if (score >= 80) return 'A';
        if (score >= 70) return 'B+';
        if (score >= 60) return 'B';
        if (score >= 50) return 'C+';
        if (score >= 40) return 'C';
        return 'D';
    };

    // Trigger grade reveal after score animation completes
    React.useEffect(() => {
        if (scoreAnimationComplete) {
            const timer = setTimeout(() => setShowGrades(true), 200);
            return () => clearTimeout(timer);
        }
    }, [scoreAnimationComplete]);

    const shareToSocial = async (platform: 'twitter' | 'farcaster') => {
        const activeRegions = regionData.filter(r => r.value > 0).length;
        const rwaAllocation = regionData.find(r => r.region === 'Commodities')?.value || 0;
        const rwaPercent = totalValue > 0 ? (rwaAllocation / totalValue) * 100 : 0;

        const baseUrl = 'https://diversifiapp.vercel.app';

        // Generate unique share ID based on user stats
        const shareId = `${Date.now().toString(36)}`;

        // Calculate percentile (mock - in production could be based on actual user data)
        const percentile = Math.min(99, Math.max(50, Math.round(diversificationScore + 10)));

        // Build dynamic share page URL with fc:miniapp meta tags
        // Note: Don't pre-encode query params - they'll be encoded when the full URL is encoded for the share intent
        const sharePageUrl = `${baseUrl}/share/${shareId}?r=${activeRegions}&d=${getLetterRating(goalScores.diversify)}&i=${getLetterRating(goalScores.hedge)}&rwa=${rwaPercent.toFixed(1)}&s=${diversificationScore}&p=${percentile}`;

        if (platform === 'twitter') {
            const twitterText = `🛡️ My DiversiFi Protection Score:\n\n` +
                `📍 ${activeRegions} regions protected\n` +
                `📊 Diversification: ${getLetterRating(goalScores.diversify)}\n` +
                `💰 Inflation Hedge: ${getLetterRating(goalScores.hedge)}\n` +
                `🏠 RWA Exposure: ${rwaPercent.toFixed(1)}%\n\n` +
                `Top ${percentile}% of users!\n\n` +
                `#DiversiFi #WealthProtection`;
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(sharePageUrl)}`);
        } else {
            // Engaging Farcaster cast text with competitive element
            const castText = `Just checked my DiversiFi protection score:\n\n` +
                `🛡️ ${activeRegions} regions • Diversification ${getLetterRating(goalScores.diversify)} • Hedge ${getLetterRating(goalScores.hedge)}\n\n` +
                `Top ${percentile}% of users. How protected are you?`;

            // Try to use SDK composeCast if in Farcaster Mini App context
            try {
                const context = await Promise.race([
                    sdk.context,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 200))
                ]);

                if (context && sdk.actions?.composeCast) {
                    // Use native SDK - embeds the share page with fc:miniapp meta for rich preview
                    sdk.actions.composeCast({
                        text: castText,
                        embeds: [sharePageUrl]
                    });
                    return;
                }
            } catch {
                // Not in Farcaster Mini App context, fall through to URL intent
            }

            // Fallback for external browsers
            const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds[]=${encodeURIComponent(sharePageUrl)}`;
            window.open(warpcastUrl);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-white font-black text-lg uppercase tracking-tight">Protection Analysis</h2>
                        <p className="text-gray-400 text-xs">Geographic Diversification & Inflation Hedge</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isRefreshing ? (
                                <span className="animate-spin">⏳</span>
                            ) : (
                                <span>🔄</span>
                            )}
                        </button>
                        <button
                            onClick={() => shareToSocial('farcaster')}
                            className="p-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-white"
                        >
                            <span>.Cast</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Diversification Score */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-end justify-between">
                        <div>
                            <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-wide">Diversification Score</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                Higher scores indicate better geographic protection
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                                {Number(animatedScore).toFixed(0)}/100
                            </div>
                            <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block mt-2 ${diversificationScore >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                    diversificationScore >= 60 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                        diversificationScore >= 40 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                {diversificationRating}
                            </div>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full"
                            style={{ width: `${diversificationScore}%` }}
                        ></div>
                    </div>
                </div>

                {/* Goal Scores */}
                <AnimatePresence>
                    {showGrades && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {Object.entries(goalScores).map(([goal, score]) => {
                                const letterGrade = getLetterRating(score);
                                const gradeColor =
                                    score >= 80 ? 'from-green-500 to-emerald-600' :
                                        score >= 60 ? 'from-blue-500 to-indigo-600' :
                                            score >= 40 ? 'from-amber-500 to-orange-500' :
                                                'from-red-500 to-red-600';

                                return (
                                    <motion.div
                                        key={goal}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700"
                                        onMouseEnter={() => setExpandedGrade(goal)}
                                        onMouseLeave={() => setExpandedGrade(null)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-black text-gray-900 dark:text-white text-sm capitalize">
                                                    {goal.replace(/([A-Z])/g, ' $1').trim()}
                                                </h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    Protection Grade
                                                </p>
                                            </div>
                                            <div className={`bg-gradient-to-r ${gradeColor} text-white text-lg font-black w-12 h-12 rounded-xl flex items-center justify-center shadow-lg`}>
                                                {letterGrade}
                                            </div>
                                        </div>

                                        {/* Expanded explanation */}
                                        <AnimatePresence>
                                            {expandedGrade === goal && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 overflow-hidden"
                                                >
                                                    <p className="text-xs text-gray-600 dark:text-gray-400">
                                                        {GRADE_EXPLANATIONS[goal as keyof typeof GRADE_EXPLANATIONS]?.[letterGrade] || 'Performance assessment'}
                                                    </p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </AnimatePresence>

                {/* Region Distribution */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-gray-900 dark:text-white text-sm">Regional Distribution</h3>
                        <button
                            onClick={() => setShowAmounts(!showAmounts)}
                            className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600"
                        >
                            {showAmounts ? 'Hide Amounts' : 'Show Amounts'}
                        </button>
                    </div>

                    <div className="mb-4">
                        <SimplePieChart
                            data={regionData}
                            onSegmentHover={setHighlightedRegionIndex}
                        />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {regionData.map((region, index) => (
                            <div
                                key={index}
                                className={`p-2 rounded-lg border text-center transition-all ${highlightedRegionIndex === index
                                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 scale-105'
                                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                                    }`}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: region.color }}
                                    ></div>
                                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                                        {region.region}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                    {showAmounts
                                        ? `$${region.value.toFixed(2)}`
                                        : `${((region.value / totalValue) * 100).toFixed(1)}%`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Network Selection */}
                {chainId !== undefined && (
                    <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/30">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="font-black text-gray-900 dark:text-white text-xs uppercase tracking-wider">Network</h3>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                    Switch blockchain for transactions
                                </p>
                            </div>
                        </div>
                        <NetworkSwitcher
                            currentChainId={chainId}
                            className="w-full"
                        />
                    </div>
                )}

                {/* Yield Summary */}
                {yieldSummary && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-black text-gray-900 dark:text-white text-sm">Yield Summary</h3>
                            <button
                                onClick={() => setShowYieldBreakdown(!showYieldBreakdown)}
                                className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-600"
                            >
                                {showYieldBreakdown ? 'Hide' : 'Show'} Breakdown
                            </button>
                        </div>

                        {yieldSummary && (
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-green-600 dark:text-green-400">
                                    {typeof yieldSummary.avgYieldRate !== 'undefined' ? yieldSummary.avgYieldRate.toFixed(2) : '0.00'}%
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-400">APY</span>
                            </div>
                        )}

                        {yieldSummary && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                                Estimated annual earnings: ${typeof yieldSummary.totalAnnualYield !== 'undefined' ? yieldSummary.totalAnnualYield.toFixed(2) : '0.00'}
                            </p>
                        )}

                        <AnimatePresence>
                            {showYieldBreakdown && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 overflow-hidden"
                                >
                                    <div className="space-y-2">
                                        {yieldSummary && yieldSummary.assets && yieldSummary.assets.map((item: AssetYieldInfo, index: number) => (
                                            <div key={index} className="flex justify-between text-sm">
                                                <span className="text-gray-600 dark:text-gray-400">{item.symbol}</span>
                                                <span className="font-medium text-green-600 dark:text-green-400">{item.apy?.toFixed(2) || '0.00'}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-3">
                    <PrimaryButton
                        onClick={onOptimize}
                    >
                        <span>Optimize Portfolio</span>
                    </PrimaryButton>
                    <PrimaryButton
                        onClick={onSwap}
                    >
                        <span>Swap Assets</span>
                    </PrimaryButton>
                </div>
            </div>
        </div>
    );
}
