import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PrimaryButton, LoadingSpinner } from '../shared/TabComponents';
import SimplePieChart from './SimplePieChart';
import NetworkSwitcher from '../swap/NetworkSwitcher';
import sdk from '@farcaster/miniapp-sdk';
import { useAnimatedCounter } from '../../hooks/use-animated-counter';
import type { MultichainPortfolio } from '../../hooks/use-multichain-balances';
import { type TokenAllocation } from '@diversifi/shared';
import { AssetInventory } from './AssetInventory';

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
    yieldSummary?: MultichainPortfolio;
}

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

const calculateRecovery = (lossPercent: number) => {
    if (lossPercent >= 100) return Infinity;
    const lossDecimal = lossPercent / 100;
    const requiredGain = (lossDecimal / (1 - lossDecimal)) * 100;
    return requiredGain;
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
    yieldSummary,
}: ProtectionAnalysisProps) {
    const [hypotheticalLoss, setHypotheticalLoss] = useState<number>(20);
    const recoveryNeeded = useMemo(() => calculateRecovery(hypotheticalLoss), [hypotheticalLoss]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showYieldBreakdown, setShowYieldBreakdown] = useState(false);
    const [highlightedRegionIndex, setHighlightedRegionIndex] = useState<number | null>(null);
    const [expandedGrade, setExpandedGrade] = useState<string | null>(null);
    const [showGrades, setShowGrades] = useState(false);
    const [showAssetInventory, setShowAssetInventory] = useState(false);
    const [showAmounts, setShowAmounts] = useState(false);

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

    React.useEffect(() => {
        if (scoreAnimationComplete) {
            const timer = setTimeout(() => setShowGrades(true), 200);
            return () => clearTimeout(timer);
        }
    }, [scoreAnimationComplete]);

    const shareToSocial = async (platform: 'twitter' | 'farcaster') => {
        const activeRegions = regionData.filter(r => r.value > 0).length;
        const rwaAllocation = regionData?.find(r => r.region === 'Commodities')?.value || 0;
        const rwaPercent = totalValue > 0 ? (rwaAllocation / totalValue) * 100 : 0;

        const baseUrl = 'https://diversifiapp.vercel.app';
        const shareId = `${Date.now().toString(36)}`;
        const percentile = Math.min(99, Math.max(50, Math.round(diversificationScore + 10)));
        const sharePageUrl = `${baseUrl}/share/${shareId}?r=${activeRegions}&d=${getLetterRating(goalScores.diversify)}&i=${getLetterRating(goalScores.hedge)}&rwa=${rwaPercent.toFixed(1)}&s=${diversificationScore}&p=${percentile}`;

        if (platform === 'twitter') {
            const twitterText = [
                '🛡️ My DiversiFi Protection Score:',
                `📍 ${activeRegions} regions protected`,
                `📊 Diversification: ${getLetterRating(goalScores.diversify)}`,
                `💰 Inflation Hedge: ${getLetterRating(goalScores.hedge)}`,
                `🏠 RWA Exposure: ${rwaPercent.toFixed(1)}%`,
                '',
                `Top ${percentile}% of users!`,
                '',
                '#DiversiFi #WealthProtection',
            ].join('\n');
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}&url=${encodeURIComponent(sharePageUrl)}`);
        } else {
            const castText = [
                'Just checked my DiversiFi protection score:',
                '',
                `🛡️ ${activeRegions} regions • Diversification ${getLetterRating(goalScores.diversify)} • Hedge ${getLetterRating(goalScores.hedge)}`,
                '',
                `Top ${percentile}% of users. How protected are you?`,
            ].join('\n');

            try {
                const context = await Promise.race([
                    sdk.context,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 200)),
                ]);

                if (context && sdk.actions?.composeCast) {
                    sdk.actions.composeCast({
                        text: castText,
                        embeds: [sharePageUrl],
                    });
                    return;
                }
            } catch {
                // Not in Farcaster Mini App context, fall through to URL intent
            }

            const warpcastUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(castText)}&embeds=${encodeURIComponent(sharePageUrl)}`;
            window.open(warpcastUrl);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
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
                            {isRefreshing ? <LoadingSpinner size="sm" /> : <span>🔄</span>}
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
                {/* Recovery Calculator Widget */}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-5 rounded-2xl border border-orange-200 dark:border-orange-800/50 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 flex items-center justify-center bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                            <span className="text-lg">⚠️</span>
                        </div>
                        <h3 className="font-black text-orange-950 dark:text-orange-50 text-xs uppercase tracking-widest">The Recovery Trap</h3>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="flex-1">
                            <label className="text-[10px] text-orange-800 dark:text-orange-300 font-bold uppercase tracking-wider mb-1.5 block">If I lose</label>
                            <div className="flex items-center bg-white/50 dark:bg-black/20 rounded-xl border border-orange-200 dark:border-orange-700 p-2.5 shadow-inner">
                                <input
                                    type="number"
                                    value={hypotheticalLoss}
                                    onChange={(e) => setHypotheticalLoss(Math.min(99, Math.max(0, Number(e.target.value))))}
                                    className="w-full bg-transparent text-sm font-bold text-gray-900 dark:text-white outline-none"
                                />
                                <span className="text-orange-500 font-black">%</span>
                            </div>
                        </div>
                        <div className="flex-1 text-center bg-white/40 dark:bg-black/10 rounded-xl p-3 border border-orange-100 dark:border-orange-800/50">
                            <label className="text-[10px] text-orange-800 dark:text-orange-300 font-bold uppercase tracking-wider mb-0.5 block">I need to gain</label>
                            <div className="text-2xl font-black text-orange-600 dark:text-orange-400">
                                {isFinite(recoveryNeeded) ? recoveryNeeded.toFixed(0) : '??'}%
                            </div>
                            <span className="text-[9px] text-orange-500 font-black uppercase">to break even</span>
                        </div>
                    </div>
                    <p className="text-[11px] text-orange-700/70 dark:text-orange-400/70 mt-4 font-medium italic leading-relaxed">
                        Volatility isn't just risk—it's a mathematical handicap. Our stable-baskets are designed to shield you from this asymmetry.
                    </p>
                </div>

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
                            <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block mt-2 ${
                                diversificationScore >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                diversificationScore >= 60 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                                diversificationScore >= 40 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`
                            }>
                                {diversificationRating}
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2.5 rounded-full"
                            style={{ width: `${diversificationScore}%` }}
                        />
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
                                        className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-xl p-4 shadow-lg"
                                        onMouseEnter={() => setExpandedGrade(goal)}
                                        onMouseLeave={() => setExpandedGrade(null)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="font-black text-gray-900 dark:text-white text-sm capitalize">
                                                    {goal.replace(/([A-Z])/g, ' $1').trim()}
                                                </h4>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Protection Grade</p>
                                            </div>
                                            <div className={`bg-gradient-to-r ${gradeColor} text-white text-lg font-black w-12 h-12 rounded-xl flex items-center justify-center shadow-lg`}>
                                                {letterGrade}
                                            </div>
                                        </div>

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
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 shadow-inner">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-black text-gray-900 dark:text-white text-sm">Regional Distribution</h3>
                        <button
                            onClick={() => setShowAmounts(!showAmounts)}
                            className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded-lg shadow-sm"
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
                                className={`p-2 rounded-lg border text-center transition-all ${
                                    highlightedRegionIndex === index
                                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-500 scale-105'
                                        : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                                }`}
                            >
                                <div className="flex items-center justify-center gap-1">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: region.color }} />
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
                                <p className="text-xs text-gray-500 dark:text-gray-400">
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

                {/* Asset Inventory */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl shadow-inner overflow-hidden">
                    <button
                        onClick={() => setShowAssetInventory(!showAssetInventory)}
                        className="w-full p-4 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-gray-400">📋</span>
                            <h3 className="font-black text-gray-900 dark:text-white text-sm uppercase tracking-tight">Your Assets</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-500 uppercase">
                                {yieldSummary?.allTokens?.length || 0} Assets
                            </span>
                            <span className="text-gray-400">{showAssetInventory ? "↑" : "↓"}</span>
                        </div>
                    </button>

                    {showAssetInventory && (
                        <div className="p-4 pt-0 border-t border-gray-100 dark:border-gray-700/50 animate-in fade-in slide-in-from-top-1">
                            <AssetInventory tokens={yieldSummary?.allTokens || []} />
                        </div>
                    )}
                </div>

                {/* Yield Summary */}
                {yieldSummary && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-black text-gray-900 dark:text-white text-sm">Yield Summary</h3>
                            <button
                                onClick={() => setShowYieldBreakdown(!showYieldBreakdown)}
                                className="text-xs bg-white dark:bg-gray-700 px-2 py-1 rounded-lg shadow-sm"
                            >
                                {showYieldBreakdown ? 'Hide' : 'Show'} Breakdown
                            </button>
                        </div>

                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-green-600 dark:text-green-400">
                                {typeof yieldSummary.avgYieldRate !== 'undefined' ? yieldSummary.avgYieldRate.toFixed(2) : '0.00'}%
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">APY</span>
                        </div>

                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                            Estimated annual earnings: ${typeof yieldSummary.totalAnnualYield !== 'undefined' ? yieldSummary.totalAnnualYield.toFixed(2) : '0.00'}
                        </p>

                        <AnimatePresence>
                            {showYieldBreakdown && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="mt-3 pt-3 border-t border-green-200 dark:border-green-800 overflow-hidden"
                                >
                                    <div className="space-y-2">
                                        {yieldSummary.tokens?.map((item: TokenAllocation, index: number) => (
                                            <div key={index} className="flex justify-between text-sm">
                                                <span className="text-gray-600 dark:text-gray-400">{item.symbol}</span>
                                                <span className="font-medium text-green-600 dark:text-green-400">{item.yieldRate?.toFixed(2) || '0.00'}%</span>
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
                    <PrimaryButton onClick={onOptimize}>
                        <span>Optimize Portfolio</span>
                    </PrimaryButton>
                    <PrimaryButton onClick={onSwap}>
                        <span>Swap Assets</span>
                    </PrimaryButton>
                </div>
            </div>
        </div>
    );
}
