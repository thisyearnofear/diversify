import React, { useState } from 'react';
import { Card, PrimaryButton } from '../shared/TabComponents';
import SimplePieChart from './SimplePieChart';
import NetworkSwitcher from '../swap/NetworkSwitcher';
import sdk from '@farcaster/miniapp-sdk';
import { useAnimatedCounter } from '../../hooks/use-animated-counter';
import type { PortfolioYieldSummary } from '../../hooks/use-portfolio-yield';

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
    onNetworkChange,
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
        const sharePageUrl = `${baseUrl}/share/${shareId}?r=${activeRegions}&d=${encodeURIComponent(getLetterRating(goalScores.diversify))}&i=${encodeURIComponent(getLetterRating(goalScores.hedge))}&rwa=${rwaPercent.toFixed(1)}&s=${diversificationScore}&p=${percentile}`;

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

    // Get region index for highlighting bars when pie segment hovered
    const getRegionIndex = (regionName: string) => {
        return regionData.findIndex(r => r.region === regionName);
    };

    const handlePieHover = (index: number | null) => {
        setHighlightedRegionIndex(index);
    };

    const toggleGradeExpansion = (grade: string) => {
        setExpandedGrade(expandedGrade === grade ? null : grade);
    };

    const hedgeGrade = getLetterRating(goalScores.hedge);
    const diversifyGrade = getLetterRating(goalScores.diversify);
    const rwaGrade = getLetterRating(goalScores.rwa);

    return (
        <Card className="overflow-hidden" padding="p-0">
            <div className="p-5 sm:p-6 space-y-6">
                {/* Header - Understated */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                            <span className="text-sm">🛡️</span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Protection Analysis</h3>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider">Oracle Live</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onNetworkChange && (
                            <NetworkSwitcher
                                currentChainId={chainId || null}
                                onNetworkChange={onNetworkChange}
                                compact={true}
                            />
                        )}
                        {refreshBalances && (
                            <button
                                onClick={handleRefresh}
                                className={`p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors ${isRefreshing ? 'animate-spin' : ''}`}
                                title="Refresh balances"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                            </button>
                        )}
                        <button
                            onClick={() => setShowAmounts(!showAmounts)}
                            className="ml-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                        >
                            {showAmounts ? 'Show %' : 'Show $'}
                        </button>
                    </div>
                </div>

                {/* Portfolio Content - Improved Mobile Layout */}
                <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
                    {/* Pie Chart - Responsive size with animated center score */}
                    <div className="w-40 sm:w-48 h-40 sm:h-48 flex-shrink-0 relative">
                        <SimplePieChart 
                            data={regionData} 
                            title="" 
                            minimal={true} 
                            interactive={true}
                            onSegmentHover={handlePieHover}
                            highlightedIndex={highlightedRegionIndex}
                        />
                        {/* Center Score Overlay with pulse animation */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            {/* Pulse ring animation */}
                            <div 
                                className={`absolute w-20 h-20 rounded-full border-2 border-blue-400/30 transition-all duration-500 ${
                                    scoreAnimationComplete ? 'scale-100 opacity-100 animate-ping' : 'scale-50 opacity-0'
                                }`}
                                style={{ animationDuration: '2s', animationIterationCount: '3' }}
                            />
                            <span className="text-2xl font-black text-gray-900 dark:text-white leading-none relative z-10">
                                {animatedScore}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase relative z-10">Score</span>
                        </div>
                    </div>

                    <div className="flex-1 w-full space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-center sm:items-end gap-2">
                            <div className="flex flex-col items-center sm:items-start">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Savings</span>
                                <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
                                    {showAmounts ? `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '100.0%'}
                                </span>
                            </div>
                            <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full border border-green-100 dark:border-green-800">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold text-green-700 dark:text-green-300 uppercase">{diversificationRating}</span>
                            </div>
                        </div>

                        {/* Geographical Spread - Horizontal Bars for Mobile */}
                        <div className="space-y-2 pt-2">
                            {regionData.filter(r => r.value > 0).map((r, index) => (
                                <div 
                                    key={r.region} 
                                    className={`space-y-1 transition-all duration-200 ${
                                        highlightedRegionIndex !== null && highlightedRegionIndex !== index 
                                            ? 'opacity-40' 
                                            : highlightedRegionIndex === index 
                                                ? 'scale-[1.02]' 
                                                : ''
                                    }`}
                                >
                                    <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500">
                                        <span>{r.region === 'Commodities' ? 'Commodities (RWA)' : r.region}</span>
                                        <span>{showAmounts ? `$${r.value.toFixed(2)}` : `${((r.value / totalValue) * 100).toFixed(1)}%`}</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{
                                                width: `${(r.value / totalValue) * 100}%`,
                                                backgroundColor: r.color
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Net Protection Summary */}
                {yieldSummary && totalValue > 0 && (
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className="text-lg">📊</span>
                                <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Net Protection</span>
                            </div>
                            <button
                                onClick={() => setShowYieldBreakdown(!showYieldBreakdown)}
                                className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                            >
                                {showYieldBreakdown ? 'Hide Details' : 'Show Details'}
                            </button>
                        </div>
                        
                        {/* Summary Row */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Earning</div>
                                <div className="text-sm font-black text-green-600 dark:text-green-400">
                                    +${yieldSummary.totalAnnualYield.toFixed(2)}<span className="text-[9px] font-bold">/yr</span>
                                </div>
                                {yieldSummary.avgYieldRate > 0 && (
                                    <div className="text-[9px] text-slate-500">({yieldSummary.avgYieldRate.toFixed(1)}% avg)</div>
                                )}
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Inflation</div>
                                <div className="text-sm font-black text-red-500 dark:text-red-400">
                                    -${yieldSummary.totalInflationCost.toFixed(2)}<span className="text-[9px] font-bold">/yr</span>
                                </div>
                                {yieldSummary.avgInflationRate > 0 && (
                                    <div className="text-[9px] text-slate-500">({yieldSummary.avgInflationRate.toFixed(1)}% avg)</div>
                                )}
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Net</div>
                                <div className={`text-sm font-black ${yieldSummary.isNetPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {yieldSummary.isNetPositive ? '+' : ''}${yieldSummary.netAnnualGain.toFixed(2)}<span className="text-[9px] font-bold">/yr</span>
                                </div>
                                <div className={`text-[9px] ${yieldSummary.isNetPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {yieldSummary.isNetPositive ? '✓ Ahead' : '⚠ Behind'}
                                </div>
                            </div>
                        </div>

                        {/* Breakdown (Progressive Disclosure) */}
                        {showYieldBreakdown && yieldSummary.assets.length > 0 && (
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-3 space-y-2">
                                {yieldSummary.assets.slice(0, 5).map((asset) => (
                                    <div key={asset.symbol} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 w-16">{asset.symbol}</span>
                                            <span className="text-slate-500">${asset.value.toFixed(2)}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {asset.apy > 0 && (
                                                <span className="text-green-600 dark:text-green-400 font-bold">+{asset.apy}%</span>
                                            )}
                                            {asset.isInflationHedge ? (
                                                <span className="text-amber-600 dark:text-amber-400 font-bold text-[10px]">🛡️ Hedge</span>
                                            ) : asset.inflationRate > 0 && (
                                                <span className="text-red-500 font-medium">-{asset.inflationRate.toFixed(1)}%</span>
                                            )}
                                            <span className={`font-black min-w-[60px] text-right ${asset.netAnnual >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                                {asset.netAnnual >= 0 ? '+' : ''}${asset.netAnnual.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                {yieldSummary.assets.length > 5 && (
                                    <div className="text-[10px] text-slate-500 text-center pt-1">
                                        +{yieldSummary.assets.length - 5} more assets
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quick insight if not earning */}
                        {!yieldSummary.isNetPositive && yieldSummary.yieldingValue === 0 && (
                            <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                <p className="text-[10px] text-amber-700 dark:text-amber-300">
                                    <span className="font-bold">💡 Tip:</span> Your holdings are not earning yield. Consider USDY (5% APY) or SYRUPUSDC (4.5% APY) on Arbitrum.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Goal-Based Ratings with Flip Animation */}
                <div className="grid grid-cols-3 gap-3">
                    {/* Hedge Grade */}
                    <div 
                        className="relative text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800 cursor-pointer transition-transform active:scale-95"
                        onClick={() => toggleGradeExpansion('hedge')}
                    >
                        <div className="text-xl mb-1">🛡️</div>
                        <div 
                            className={`text-sm font-black text-blue-900 dark:text-blue-100 leading-none mb-1 transition-all duration-500 ${
                                showGrades ? 'opacity-100 transform-none' : 'opacity-0 scale-75'
                            }`}
                        >
                            {hedgeGrade}
                        </div>
                        <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase">Hedge</div>
                        
                        {/* Expanded explanation */}
                        {expandedGrade === 'hedge' && (
                            <div className="absolute inset-x-0 -bottom-2 translate-y-full z-10 p-3 bg-blue-100 dark:bg-blue-800 rounded-lg text-[10px] text-blue-800 dark:text-blue-200 shadow-lg">
                                {GRADE_EXPLANATIONS.hedge[hedgeGrade]}
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-blue-100 dark:bg-blue-800 rotate-45" />
                            </div>
                        )}
                    </div>

                    {/* Diversify Grade */}
                    <div 
                        className="relative text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800 cursor-pointer transition-transform active:scale-95"
                        onClick={() => toggleGradeExpansion('diversify')}
                    >
                        <div className="text-xl mb-1">🌍</div>
                        <div 
                            className={`text-sm font-black text-emerald-900 dark:text-emerald-100 leading-none mb-1 transition-all duration-500 delay-100 ${
                                showGrades ? 'opacity-100 transform-none' : 'opacity-0 scale-75'
                            }`}
                        >
                            {diversifyGrade}
                        </div>
                        <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Diversify</div>
                        
                        {/* Expanded explanation */}
                        {expandedGrade === 'diversify' && (
                            <div className="absolute inset-x-0 -bottom-2 translate-y-full z-10 p-3 bg-emerald-100 dark:bg-emerald-800 rounded-lg text-[10px] text-emerald-800 dark:text-emerald-200 shadow-lg">
                                {GRADE_EXPLANATIONS.diversify[diversifyGrade]}
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-100 dark:bg-emerald-800 rotate-45" />
                            </div>
                        )}
                    </div>

                    {/* RWA Grade */}
                    <div 
                        className="relative text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800 cursor-pointer transition-transform active:scale-95"
                        onClick={() => toggleGradeExpansion('rwa')}
                    >
                        <div className="text-xl mb-1">🥇</div>
                        <div 
                            className={`text-sm font-black text-amber-900 dark:text-amber-100 leading-none mb-1 transition-all duration-500 delay-200 ${
                                showGrades ? 'opacity-100 transform-none' : 'opacity-0 scale-75'
                            }`}
                        >
                            {rwaGrade}
                        </div>
                        <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">RWA</div>
                        
                        {/* Expanded explanation */}
                        {expandedGrade === 'rwa' && (
                            <div className="absolute inset-x-0 -bottom-2 translate-y-full z-10 p-3 bg-amber-100 dark:bg-amber-800 rounded-lg text-[10px] text-amber-800 dark:text-amber-200 shadow-lg">
                                {GRADE_EXPLANATIONS.rwa[rwaGrade]}
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-100 dark:bg-amber-800 rotate-45" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={onOptimize}
                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            Get Advice 🤖
                        </button>
                        <PrimaryButton onClick={onSwap} fullWidth size="lg">
                            Swap & Protect
                        </PrimaryButton>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => shareToSocial('twitter')}
                            className="px-4 py-2 bg-black text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-gray-900 transition-colors"
                        >
                            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            Share on 𝕏
                        </button>
                        <button
                            onClick={() => shareToSocial('farcaster')}
                            className="px-4 py-2 bg-[#855DCD] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-[#744ebc] transition-colors"
                        >
                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.5-7.5-7.5-7.5L5 4l6 6-6 6 1.5 1.5z" />
                            </svg>
                            Cast Status
                        </button>
                    </div>
                </div>
            </div>
        </Card>
    );
}
