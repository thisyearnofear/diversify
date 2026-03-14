/**
 * Hyperliquid Position Management Service
 * Tracks open positions, PnL, funding rates, and liquidation risk
 * for commodity perp positions on Hyperliquid.
 */

import {
    fetchHyperliquidPrices,
    fetchHyperliquidUserState,
    HYPERLIQUID_MARKET_TICKERS,
    HyperliquidPosition,
    HyperliquidUserState,
    HyperliquidAllMids,
} from './strategies/hyperliquid-perp.strategy';

export interface CommodityPosition {
    coin: string;
    symbol: string;
    size: number;
    entryPrice: number;
    currentPrice: number;
    positionValue: number;
    unrealizedPnl: number;
    unrealizedPnlPercent: number;
    liquidationPrice: number | null;
    leverage: number;
    marginUsed: number;
    side: 'long' | 'short';
}

export interface PortfolioSummary {
    totalValue: number;
    totalMarginUsed: number;
    totalUnrealizedPnl: number;
    totalUnrealizedPnlPercent: number;
    availableBalance: number;
    positions: CommodityPosition[];
    lastUpdated: number;
}

// Reverse map: Hyperliquid ticker -> DiversiFi symbol
const TICKER_TO_SYMBOL: Record<string, string> = {};
for (const [symbol, ticker] of Object.entries(HYPERLIQUID_MARKET_TICKERS)) {
    TICKER_TO_SYMBOL[ticker] = symbol;
}

const COMMODITY_TICKERS = new Set(Object.values(HYPERLIQUID_MARKET_TICKERS));

export class HyperliquidPositionService {
    private cachedState: HyperliquidUserState | null = null;
    private cachedPrices: HyperliquidAllMids | null = null;
    private lastFetchTime = 0;
    private readonly CACHE_TTL_MS = 5000; // 5 second cache

    /**
     * Get all commodity positions for a user
     */
    async getPositions(userAddress: string): Promise<CommodityPosition[]> {
        const [state, prices] = await this.fetchData(userAddress);

        return state.assetPositions
            .filter(ap => COMMODITY_TICKERS.has(ap.position.coin))
            .map(ap => this.mapPosition(ap.position, prices))
            .filter((p): p is CommodityPosition => p !== null);
    }

    /**
     * Get full portfolio summary including account-level metrics
     */
    async getPortfolioSummary(userAddress: string): Promise<PortfolioSummary> {
        const [state, prices] = await this.fetchData(userAddress);
        const positions = state.assetPositions
            .filter(ap => COMMODITY_TICKERS.has(ap.position.coin))
            .map(ap => this.mapPosition(ap.position, prices))
            .filter((p): p is CommodityPosition => p !== null);

        const totalValue = positions.reduce((sum, p) => sum + p.positionValue, 0);
        const totalMarginUsed = positions.reduce((sum, p) => sum + p.marginUsed, 0);
        const totalUnrealizedPnl = positions.reduce((sum, p) => sum + p.unrealizedPnl, 0);
        const totalUnrealizedPnlPercent = totalMarginUsed > 0
            ? (totalUnrealizedPnl / totalMarginUsed) * 100
            : 0;

        return {
            totalValue,
            totalMarginUsed,
            totalUnrealizedPnl,
            totalUnrealizedPnlPercent,
            availableBalance: parseFloat(state.withdrawable || '0'),
            positions,
            lastUpdated: Date.now(),
        };
    }

    /**
     * Get a single position by coin
     */
    async getPosition(userAddress: string, coin: string): Promise<CommodityPosition | null> {
        const positions = await this.getPositions(userAddress);
        return positions.find(p => p.coin === coin) || null;
    }

    /**
     * Check if user has any open commodity positions
     */
    async hasOpenPositions(userAddress: string): Promise<boolean> {
        const positions = await this.getPositions(userAddress);
        return positions.length > 0;
    }

    /**
     * Get positions at liquidation risk (within 10% of liquidation price)
     */
    async getAtRiskPositions(userAddress: string): Promise<CommodityPosition[]> {
        const positions = await this.getPositions(userAddress);
        return positions.filter(p => {
            if (!p.liquidationPrice) return false;
            const distancePercent = Math.abs(p.currentPrice - p.liquidationPrice) / p.currentPrice * 100;
            return distancePercent < 10;
        });
    }

    /**
     * Clear cached data (force refresh on next call)
     */
    clearCache(): void {
        this.cachedState = null;
        this.cachedPrices = null;
        this.lastFetchTime = 0;
    }

    private async fetchData(userAddress: string): Promise<[HyperliquidUserState, HyperliquidAllMids]> {
        const now = Date.now();
        if (this.cachedState && this.cachedPrices && (now - this.lastFetchTime) < this.CACHE_TTL_MS) {
            return [this.cachedState, this.cachedPrices];
        }

        const [state, prices] = await Promise.all([
            fetchHyperliquidUserState(userAddress),
            fetchHyperliquidPrices(),
        ]);

        this.cachedState = state;
        this.cachedPrices = prices;
        this.lastFetchTime = now;

        return [state, prices];
    }

    private mapPosition(pos: HyperliquidPosition, prices: HyperliquidAllMids): CommodityPosition | null {
        const size = parseFloat(pos.szi);
        if (size === 0) return null;

        const currentPriceStr = prices[pos.coin];
        if (!currentPriceStr) return null;

        const currentPrice = parseFloat(currentPriceStr);
        const entryPrice = parseFloat(pos.entryPx);
        const positionValue = parseFloat(pos.positionValue);
        const unrealizedPnl = parseFloat(pos.unrealizedPnl);
        const marginUsed = parseFloat(pos.marginUsed);
        const liquidationPx = pos.liquidationPx ? parseFloat(pos.liquidationPx) : null;

        return {
            coin: pos.coin,
            symbol: TICKER_TO_SYMBOL[pos.coin] || pos.coin,
            size: Math.abs(size),
            entryPrice,
            currentPrice,
            positionValue,
            unrealizedPnl,
            unrealizedPnlPercent: marginUsed > 0 ? (unrealizedPnl / marginUsed) * 100 : 0,
            liquidationPrice: liquidationPx,
            leverage: pos.leverage?.value ?? 1,
            marginUsed,
            side: size > 0 ? 'long' : 'short',
        };
    }
}
