/**
 * Commodity Trading Panel
 * UI for Hyperliquid commodity perp positions (GOLD, SILVER, OIL, COPPER)
 * Shows live prices, open positions with PnL, and buy/sell actions
 */

import { useState } from 'react';
import { useHyperliquid } from '../../hooks/use-hyperliquid';
import type { CommodityPosition } from '@diversifi/shared';

interface CommodityTradingProps {
    address?: string | null;
    onTrade?: (action: 'buy' | 'sell', symbol: string, amount: string) => Promise<void>;
    chainId?: number | null;
}

const COMMODITY_ICONS: Record<string, string> = {
    GOLD: '🥇',
    SILVER: '🥈',
    OIL: '🛢️',
    COPPER: '🔶',
};

function formatUsd(value: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

function formatPnl(value: number): string {
    const prefix = value >= 0 ? '+' : '';
    return prefix + formatUsd(value);
}

function PnlBadge({ value, percent }: { value: number; percent: number }) {
    const isPositive = value >= 0;
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            isPositive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
            {formatPnl(value)} ({percent >= 0 ? '+' : ''}{percent.toFixed(2)}%)
        </span>
    );
}

function PositionCard({
    position,
    onClose,
}: {
    position: CommodityPosition;
    onClose: (coin: string) => void;
}) {
    const icon = COMMODITY_ICONS[position.symbol] || '📊';

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{position.symbol}</h4>
                        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase">{position.side} · {position.leverage}x</span>
                    </div>
                </div>
                <PnlBadge value={position.unrealizedPnl} percent={position.unrealizedPnlPercent} />
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                    <span className="text-gray-500 dark:text-gray-400">Size</span>
                    <p className="font-medium dark:text-gray-200">{position.size.toFixed(4)}</p>
                </div>
                <div>
                    <span className="text-gray-500 dark:text-gray-400">Entry</span>
                    <p className="font-medium dark:text-gray-200">{formatUsd(position.entryPrice)}</p>
                </div>
                <div>
                    <span className="text-gray-500 dark:text-gray-400">Current</span>
                    <p className="font-medium dark:text-gray-200">{formatUsd(position.currentPrice)}</p>
                </div>
                <div>
                    <span className="text-gray-500 dark:text-gray-400">Value</span>
                    <p className="font-medium dark:text-gray-200">{formatUsd(position.positionValue)}</p>
                </div>
            </div>

            {position.liquidationPrice && (
                <div className="text-xs text-orange-600 mb-2">
                    ⚠️ Liq. price: {formatUsd(position.liquidationPrice)}
                </div>
            )}

            <button
                onClick={() => onClose(position.coin)}
                className="w-full py-1.5 px-3 text-sm font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
            >
                Close Position
            </button>
        </div>
    );
}

function PriceCard({
    symbol,
    ticker,
    price,
    name,
    onBuy,
}: {
    symbol: string;
    ticker: string;
    price: number;
    name: string;
    onBuy: (symbol: string) => void;
}) {
    const icon = COMMODITY_ICONS[symbol] || '📊';

    return (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{icon}</span>
                <div>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{name}</h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{ticker}</span>
                </div>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">{formatUsd(price)}</p>
            <button
                onClick={() => onBuy(symbol)}
                className="w-full py-1.5 px-3 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors"
            >
                Buy {symbol}
            </button>
        </div>
    );
}

export default function CommodityTrading({ address, onTrade, chainId }: CommodityTradingProps) {
    const { positions, portfolio, prices, isLoading, error, refresh, atRiskPositions, unavailableSymbols } = useHyperliquid({
        address,
        autoRefresh: true,
        refreshInterval: 10000,
    });

    const [tradeModal, setTradeModal] = useState<{ symbol: string; action: 'buy' | 'sell' } | null>(null);
    const [tradeAmount, setTradeAmount] = useState('');
    const [isTrading, setIsTrading] = useState(false);
    const [tradeError, setTradeError] = useState<string | null>(null);

    const handleBuy = (symbol: string) => {
        setTradeModal({ symbol, action: 'buy' });
        setTradeAmount('');
        setTradeError(null);
    };

    const handleClose = (coin: string) => {
        setTradeModal({ symbol: coin, action: 'sell' });
        setTradeAmount('');
        setTradeError(null);
    };

    const executeTrade = async () => {
        if (!tradeModal || !tradeAmount || !onTrade) return;

        const amount = parseFloat(tradeAmount);
        if (isNaN(amount) || amount < 10) {
            setTradeError('Minimum trade amount is $10');
            return;
        }

        setIsTrading(true);
        setTradeError(null);

        try {
            await onTrade(tradeModal.action, tradeModal.symbol, tradeAmount);
            setTradeModal(null);
            refresh();
        } catch (err: any) {
            setTradeError(err.message || 'Trade failed');
        } finally {
            setIsTrading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Commodity Markets</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Synthetic 1x exposure via Hyperliquid perps · USDC collateral
                    </p>
                </div>
                <button
                    onClick={refresh}
                    disabled={isLoading}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Refresh"
                >
                    <span className={isLoading ? 'animate-spin inline-block' : ''}>🔄</span>
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Risk Warning */}
            {atRiskPositions.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-700">
                    ⚠️ {atRiskPositions.length} position{atRiskPositions.length > 1 ? 's' : ''} near liquidation price.
                    Consider reducing exposure.
                </div>
            )}

            {/* Portfolio Summary */}
            {portfolio && positions.length > 0 && (
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="text-gray-500 dark:text-gray-400">Total Value</span>
                            <p className="font-bold text-gray-900 dark:text-gray-100">{formatUsd(portfolio.totalValue)}</p>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400">Unrealized PnL</span>
                            <p className={`font-bold ${portfolio.totalUnrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatPnl(portfolio.totalUnrealizedPnl)}
                            </p>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400">Margin Used</span>
                            <p className="font-bold text-gray-900 dark:text-gray-100">{formatUsd(portfolio.totalMarginUsed)}</p>
                        </div>
                        <div>
                            <span className="text-gray-500 dark:text-gray-400">Available</span>
                            <p className="font-bold text-gray-900 dark:text-gray-100">{formatUsd(portfolio.availableBalance)}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Open Positions */}
            {positions.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Open Positions</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {positions.map(pos => (
                            <PositionCard key={pos.coin} position={pos} onClose={handleClose} />
                        ))}
                    </div>
                </div>
            )}

            {/* Market Prices */}
            <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Markets</h4>
                {prices.length === 0 && !isLoading && (
                    <p className="text-sm text-gray-400">
                        {unavailableSymbols.length > 0
                            ? `No supported commodity perps currently available on Hyperliquid (${unavailableSymbols.join(', ')} unavailable).`
                            : 'Loading prices...'}
                    </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {prices.map(p => (
                        <PriceCard
                            key={p.symbol}
                            symbol={p.symbol}
                            ticker={p.ticker}
                            price={p.price}
                            name={p.name}
                            onBuy={handleBuy}
                        />
                    ))}
                </div>
            </div>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                Commodity positions are synthetic 1x perpetual contracts on Hyperliquid.
                Not physical commodity ownership. Subject to funding rates.
            </p>

            {/* Trade Modal */}
            {tradeModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-sm w-full p-6">
                        <h3 className="text-lg font-bold mb-4 dark:text-gray-100">
                            {COMMODITY_ICONS[tradeModal.symbol] || '📊'}{' '}
                            {tradeModal.action === 'buy' ? 'Buy' : 'Close'} {tradeModal.symbol}
                        </h3>

                        <div className="mb-4">
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                                Amount (USDC)
                            </label>
                            <input
                                type="number"
                                min="10"
                                step="1"
                                value={tradeAmount}
                                onChange={e => setTradeAmount(e.target.value)}
                                placeholder="Min $10"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                                autoFocus
                            />
                        </div>

                        {tradeError && (
                            <p className="text-sm text-red-600 mb-3">{tradeError}</p>
                        )}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setTradeModal(null)}
                                className="flex-1 py-2 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                disabled={isTrading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={executeTrade}
                                disabled={isTrading || !tradeAmount}
                                className={`flex-1 py-2 px-4 text-sm font-medium text-white rounded-lg ${
                                    tradeModal.action === 'buy'
                                        ? 'bg-emerald-600 hover:bg-emerald-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                } disabled:opacity-50`}
                            >
                                {isTrading ? 'Processing...' : tradeModal.action === 'buy' ? 'Buy' : 'Close'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
