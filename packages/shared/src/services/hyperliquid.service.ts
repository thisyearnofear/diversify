/**
 * Hyperliquid Service (2026 Edition)
 * Single source of truth for Hyperliquid interactions.
 * 
 * Core Principles:
 * - CONSOLIDATION: Merges positions, info, and exchange logic.
 * - CLEAN: Explicit separation between Info (public) and Exchange (signed) APIs.
 * - MODULAR: Supports both User-Signed and Agent-Signed modes.
 */

import { ethers, providers } from 'ethers';
import { 
    fetchHyperliquidPrices, 
    fetchHyperliquidUserState, 
    fetchHyperliquidMeta,
    placeHyperliquidOrder,
    HYPERLIQUID_MARKET_TICKERS
} from './swap/strategies/hyperliquid-perp.strategy';
import { getHyperliquidAccountStatus, activateHyperliquidAccount } from './swap/hyperliquid-bridge.service';

export interface HedgePosition {
    symbol: string;
    size: number;
    entryPrice: number;
    currentPrice: number;
    unrealizedPnl: number;
    status: 'ACTIVE' | 'CLOSING' | 'CLOSED';
}

export class HyperliquidService {
    private readonly HL_API_BASE = 'https://api.hyperliquid.xyz';

    /**
     * Get account status and health
     */
    async getAccountStatus(address: string) {
        return await getHyperliquidAccountStatus(address);
    }

    /**
     * Fetch all available commodity prices
     */
    async getPrices() {
        return await fetchHyperliquidPrices();
    }

    /**
     * Open an autonomous hedge (1x Short)
     * This uses the Agent's scoped signing key
     */
    async openHedge(
        signer: ethers.Signer, 
        symbol: string, 
        usdAmount: number
    ): Promise<string> {
        const ticker = HYPERLIQUID_MARKET_TICKERS[symbol];
        if (!ticker) throw new Error(`Unsupported hedge symbol: ${symbol}`);

        const prices = await this.getPrices();
        const currentPrice = parseFloat(prices[ticker]);
        const sz = usdAmount / currentPrice;

        console.log(`[Hyperliquid Service] Opening 1x SHORT hedge for ${ticker} ($${usdAmount})`);

        // isBuy = false for Shorting
        const result = await placeHyperliquidOrder(
            signer,
            ticker,
            false, 
            sz,
            currentPrice * 0.99 // 1% slippage for market entry
        );

        if (result.status !== 'ok') {
            throw new Error(`Hyperliquid hedge failed: ${JSON.stringify(result.response)}`);
        }

        const oid = result.response?.data?.statuses[0]?.filled?.oid || 
                    result.response?.data?.statuses[0]?.resting?.oid;
        
        return `hl-hedge-${ticker}-${oid}`;
    }

    /**
     * Close all active hedges for a symbol
     */
    async closeHedge(signer: ethers.Signer, symbol: string): Promise<boolean> {
        const address = await signer.getAddress();
        const state = await fetchHyperliquidUserState(address);
        const ticker = HYPERLIQUID_MARKET_TICKERS[symbol];

        const position = state.assetPositions.find(p => p.position.coin === ticker);
        if (!position || parseFloat(position.position.szi) === 0) {
            return true; // Already closed
        }

        const sz = Math.abs(parseFloat(position.position.szi));
        const currentPrice = parseFloat((await this.getPrices())[ticker]);

        console.log(`[Hyperliquid Service] Closing hedge for ${ticker} (Size: ${sz})`);

        // isBuy = true to close a Short
        const result = await placeHyperliquidOrder(
            signer,
            ticker,
            true, 
            sz,
            currentPrice * 1.01 // 1% slippage
        );

        return result.status === 'ok';
    }
}

export const hyperliquidService = new HyperliquidService();
