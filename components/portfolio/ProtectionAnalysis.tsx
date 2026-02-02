import React, { useState } from 'react';
import { Card, PrimaryButton } from '../shared/TabComponents';
import SimplePieChart from './SimplePieChart';
import NetworkSwitcher from '../swap/NetworkSwitcher';

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
}

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
    refreshBalances
}: ProtectionAnalysisProps) {
    const [showAmounts, setShowAmounts] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

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

    const shareToSocial = (platform: 'twitter' | 'farcaster') => {
        const activeRegions = regionData.filter(r => r.value > 0).length;
        const rwaAllocation = regionData.find(r => r.region === 'Commodity' || r.region === 'Commodities')?.value || 0;
        const rwaPercent = totalValue > 0 ? (rwaAllocation / totalValue) * 100 : 0;

        const text = `My savings are protected across ${activeRegions} regions with DiversiFi 🛡️\n\n` +
            `Global Diversification: ${getLetterRating(goalScores.diversify)}\n` +
            `Inflation Hedge: ${getLetterRating(goalScores.hedge)}\n` +
            `Real Asset Exposure: ${rwaPercent.toFixed(1)}%\n\n` +
            `Building resilience against currency debasement. 📈\n\n` +
            `#WealthProtection #DiversiFi #RWA`;

        const url = typeof window !== 'undefined' ? window.location.origin : 'https://diversifi.app';

        if (platform === 'twitter') {
            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
        } else {
            window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent(text)}&embeds[]=${encodeURIComponent(url)}`);
        }
    };

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
                    {/* Pie Chart - Responsive size */}
                    <div className="w-40 sm:w-48 h-40 sm:h-48 flex-shrink-0 relative">
                        <SimplePieChart data={regionData} title="" minimal={true} />
                        {/* Center Score Overlay */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">{diversificationScore}</span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase">Score</span>
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
                            {regionData.filter(r => r.value > 0).map((r) => (
                                <div key={r.region} className="space-y-1">
                                    <div className="flex justify-between text-[10px] font-bold uppercase text-gray-500">
                                        <span>{r.region === 'Commodity' || r.region === 'Commodities' ? 'Real Assets (RWA)' : r.region}</span>
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

                {/* Goal-Based Ratings */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <div className="text-xl mb-1">🛡️</div>
                        <div className="text-sm font-black text-blue-900 dark:text-blue-100 leading-none mb-1">{getLetterRating(goalScores.hedge)}</div>
                        <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase">Hedge</div>
                    </div>
                    <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                        <div className="text-xl mb-1">🌍</div>
                        <div className="text-sm font-black text-emerald-900 dark:text-emerald-100 leading-none mb-1">{getLetterRating(goalScores.diversify)}</div>
                        <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Diversify</div>
                    </div>
                    <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                        <div className="text-xl mb-1">🥇</div>
                        <div className="text-sm font-black text-amber-900 dark:text-amber-100 leading-none mb-1">{getLetterRating(goalScores.rwa)}</div>
                        <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">RWA</div>
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
