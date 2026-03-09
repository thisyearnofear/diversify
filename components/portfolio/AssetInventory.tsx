import React, { useState } from 'react';
import type { TokenBalance } from '@/hooks/use-multichain-balances';
import { usePaperPortfolio } from '@/hooks/use-paper-portfolio';

interface AssetInventoryProps {
    tokens: TokenBalance[];
    className?: string;
    showPaperToggle?: boolean;
}

export const AssetInventory: React.FC<AssetInventoryProps> = ({
    tokens,
    className = "",
    showPaperToggle = false
}) => {
    const [showPaper, setShowPaper] = useState(false);
    const { positions, cash, getMetrics, isLoaded } = usePaperPortfolio();

    // Get paper portfolio metrics with mock prices (in real use, pass actual prices)
    const paperMetrics = getMetrics({});

    if (!tokens || tokens.length === 0) return null;

    const hasPaperPositions = Object.keys(positions).length > 0;

    return (
        <div className={`space-y-2 ${className}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <h3 className="font-black text-gray-900 dark:text-white text-xs uppercase tracking-widest">
                        {showPaper ? '🎮 Paper Portfolio' : 'Your Portfolio'}
                    </h3>
                    {showPaperToggle && hasPaperPositions && (
                        <button
                            onClick={() => setShowPaper(!showPaper)}
                            className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-bold hover:bg-blue-200 transition"
                        >
                            {showPaper ? 'Show Real' : 'Show Paper'}
                        </button>
                    )}
                </div>
                <span className="text-xs font-black uppercase text-gray-400">Value</span>
            </div>

            {/* Paper Portfolio Summary */}
            {showPaper && isLoaded && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800 mb-3">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-500">Cash</span>
                        <span className="text-sm font-bold">${cash.toFixed(2)}</span>
                    </div>
                    {paperMetrics && (
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Total P&L</span>
                            <span className={`text-sm font-bold ${paperMetrics.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {paperMetrics.totalPnl >= 0 ? '+' : ''}{paperMetrics.pnlPercentage.toFixed(2)}%
                            </span>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-1.5 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                {showPaper ? (
                    // Paper Portfolio View
                    Object.values(positions).length > 0 ? (
                        Object.values(positions).map((position) => (
                            <div key={position.symbol} className="flex items-center justify-between p-2.5 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                                <div className="flex items-center gap-3">
                                    <div className="size-8 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center text-sm shadow-md">
                                        {position.symbol.slice(0, 1)}
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">
                                            {position.symbol}
                                        </div>
                                        <div className="text-xs text-gray-400 font-bold uppercase leading-none">
                                            Avg: ${position.avgBuyPrice.toFixed(4)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">
                                        {position.amount.toFixed(4)}
                                    </div>
                                    <div className="text-xs text-blue-600 dark:text-blue-400 font-bold leading-none">
                                        Paper
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-4 text-gray-500 text-xs">
                            No paper positions yet. Start trading on the Trade page!
                        </div>
                    )
                ) : (
                    // Real Portfolio View
                    tokens.map((token, index) => (
                        <div key={`${token.symbol}-${index}`} className="flex items-center justify-between p-2.5 bg-gray-50 dark:bg-gray-800/50 rounded-xl shadow-md hover:shadow-lg transition-all">
                            <div className="flex items-center gap-3">
                                <div className="size-8 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center text-sm shadow-md">
                                    {token.symbol.slice(0, 1)}
                                </div>
                                <div>
                                    <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">
                                        {token.symbol}
                                    </div>
                                    <div className="text-xs text-gray-400 font-bold uppercase leading-none flex items-center gap-1">
                                        <span className="size-1 rounded-full bg-blue-500"></span>
                                        {token.chainName}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1">
                                    {token.formattedBalance}
                                </div>
                                <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold leading-none">
                                    ${token.value.toFixed(2)}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Toggle hint */}
            {showPaperToggle && hasPaperPositions && !showPaper && (
                <p className="text-xs text-center text-gray-400 mt-2">
                    💡 Toggle "Show Paper" to see your simulated portfolio
                </p>
            )}
        </div>
    );
};
