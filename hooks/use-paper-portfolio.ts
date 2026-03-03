/**
 * Paper Portfolio Hook
 * Tracks simulated trades and P&L for paper trading
 * ENHANCEMENT FIRST: Works with existing portfolio components
 */

import { useState, useEffect, useCallback } from 'react';

interface PaperTrade {
    id: string;
    symbol: string;
    type: 'buy' | 'sell';
    amount: number;
    price: number; // Price at time of trade
    timestamp: number;
    market: 'robinhood' | 'emerging-markets';
}

interface PaperPosition {
    symbol: string;
    amount: number;
    avgBuyPrice: number;
    market: 'robinhood' | 'emerging-markets';
    trades: PaperTrade[];
}

interface PaperPortfolio {
    cash: number; // Starting with $10,000 USD equivalent
    positions: Record<string, PaperPosition>;
    trades: PaperTrade[];
    createdAt: number;
}

interface PortfolioMetrics {
    totalValue: number;
    totalPnl: number;
    pnlPercentage: number;
    dayPnl: number;
    positionsCount: number;
}

const STARTING_CASH = 10000;
const STORAGE_KEY = 'diversifi-paper-portfolio';

export function usePaperPortfolio() {
    const [portfolio, setPortfolio] = useState<PaperPortfolio | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                setPortfolio(parsed);
            } catch (e) {
                console.error('Failed to parse paper portfolio:', e);
                initializePortfolio();
            }
        } else {
            initializePortfolio();
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage whenever portfolio changes
    useEffect(() => {
        if (portfolio) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
        }
    }, [portfolio]);

    const initializePortfolio = () => {
        const newPortfolio: PaperPortfolio = {
            cash: STARTING_CASH,
            positions: {},
            trades: [],
            createdAt: Date.now(),
        };
        setPortfolio(newPortfolio);
    };

    const executeTrade = useCallback((
        symbol: string,
        type: 'buy' | 'sell',
        amount: number,
        price: number,
        market: 'robinhood' | 'emerging-markets'
    ): { success: boolean; error?: string } => {
        if (!portfolio) return { success: false, error: 'Portfolio not initialized' };

        const tradeValue = amount * price;
        const trade: PaperTrade = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            symbol,
            type,
            amount,
            price,
            timestamp: Date.now(),
            market,
        };

        setPortfolio(prev => {
            if (!prev) return prev;

            const newPortfolio = { ...prev };
            const position = newPortfolio.positions[symbol];

            if (type === 'buy') {
                // Check if enough cash
                if (newPortfolio.cash < tradeValue) {
                    return prev; // Don't execute if insufficient funds
                }

                newPortfolio.cash -= tradeValue;

                if (position) {
                    // Update existing position
                    const totalValue = position.amount * position.avgBuyPrice + tradeValue;
                    const totalAmount = position.amount + amount;
                    newPortfolio.positions[symbol] = {
                        ...position,
                        amount: totalAmount,
                        avgBuyPrice: totalValue / totalAmount,
                        trades: [...position.trades, trade],
                    };
                } else {
                    // Create new position
                    newPortfolio.positions[symbol] = {
                        symbol,
                        amount,
                        avgBuyPrice: price,
                        market,
                        trades: [trade],
                    };
                }
            } else {
                // Sell
                if (!position || position.amount < amount) {
                    return prev; // Don't execute if insufficient holdings
                }

                newPortfolio.cash += tradeValue;
                const newAmount = position.amount - amount;

                if (newAmount === 0) {
                    delete newPortfolio.positions[symbol];
                } else {
                    newPortfolio.positions[symbol] = {
                        ...position,
                        amount: newAmount,
                        trades: [...position.trades, trade],
                    };
                }
            }

            newPortfolio.trades = [...newPortfolio.trades, trade];
            return newPortfolio;
        });

        return { success: true };
    }, [portfolio]);

    const getPosition = useCallback((symbol: string): PaperPosition | null => {
        return portfolio?.positions[symbol] || null;
    }, [portfolio]);

    const getMetrics = useCallback((currentPrices: Record<string, number>): PortfolioMetrics | null => {
        if (!portfolio) return null;

        let positionsValue = 0;
        let totalCost = 0;

        Object.values(portfolio.positions).forEach(position => {
            const currentPrice = currentPrices[position.symbol] || position.avgBuyPrice;
            positionsValue += position.amount * currentPrice;
            totalCost += position.amount * position.avgBuyPrice;
        });

        const totalValue = portfolio.cash + positionsValue;
        const totalPnl = totalValue - STARTING_CASH;
        const pnlPercentage = (totalPnl / STARTING_CASH) * 100;

        // Calculate 24h P&L (simplified - uses last trade as reference)
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const recentTrades = portfolio.trades.filter(t => t.timestamp > dayAgo);
        const dayPnl = recentTrades.reduce((sum, trade) => {
            const value = trade.amount * trade.price;
            return sum + (trade.type === 'sell' ? value : -value);
        }, 0);

        return {
            totalValue,
            totalPnl,
            pnlPercentage,
            dayPnl,
            positionsCount: Object.keys(portfolio.positions).length,
        };
    }, [portfolio]);

    const resetPortfolio = useCallback(() => {
        if (confirm('Are you sure you want to reset your paper portfolio? All trades will be lost.')) {
            initializePortfolio();
        }
    }, []);

    const getTradeHistory = useCallback((limit?: number): PaperTrade[] => {
        if (!portfolio) return [];
        const trades = [...portfolio.trades].sort((a, b) => b.timestamp - a.timestamp);
        return limit ? trades.slice(0, limit) : trades;
    }, [portfolio]);

    return {
        portfolio,
        isLoaded,
        cash: portfolio?.cash || STARTING_CASH,
        positions: portfolio?.positions || {},
        executeTrade,
        getPosition,
        getMetrics,
        resetPortfolio,
        getTradeHistory,
    };
}
