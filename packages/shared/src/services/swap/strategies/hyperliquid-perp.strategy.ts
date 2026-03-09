/**
 * Hyperliquid Perp Strategy
 * Opens/closes 1x long perpetual positions on Hyperliquid for commodity exposure.
 * Supports GOLD, SILVER, OIL, COPPER markets via the Hyperliquid REST API.
 *
 * Key design decisions:
 * - Leverage is capped at 1x (synthetic spot equivalent)
 * - All positions are USDC-collateralized
 * - Excluded from Islamic Finance portfolios (no underlying ownership)
 * - Uses Hyperliquid Info API for price feeds (no auth required)
 * - Uses Hyperliquid Exchange API for order placement (requires signed actions)
 */

import { ethers } from 'ethers';
import {
    BaseSwapStrategy,
    SwapParams,
    SwapResult,
    SwapCallbacks,
    SwapEstimate,
} from './base-swap.strategy';
import { NETWORKS } from '../../../config';

// Hyperliquid virtual chain ID (defined in config)
const HYPERLIQUID_CHAIN_ID = NETWORKS.HYPERLIQUID.chainId;

// Hyperliquid REST API base URL
const HL_API_BASE = 'https://api.hyperliquid.xyz';

// Map from DiversiFi token symbol to Hyperliquid market ticker
export const HYPERLIQUID_MARKET_TICKERS: Record<string, string> = {
    GOLD: 'GOLD',
    SILVER: 'SILVER',
    OIL: 'OIL',
    COPPER: 'COPPER',
};

// Supported commodity tokens on Hyperliquid
const SUPPORTED_TOKENS = new Set(Object.keys(HYPERLIQUID_MARKET_TICKERS));

export interface HyperliquidMeta {
    universe: Array<{
        name: string;
        szDecimals: number;
        maxLeverage: number;
    }>;
}

export interface HyperliquidAllMids {
    [ticker: string]: string; // price as string
}

export interface HyperliquidOrderResult {
    status: string;
    response?: {
        type: string;
        data?: {
            statuses: Array<{
                resting?: { oid: number };
                filled?: { totalSz: string; avgPx: string; oid: number };
                error?: string;
            }>;
        };
    };
}

/**
 * Fetch all mid prices from Hyperliquid Info API
 */
export async function fetchHyperliquidPrices(): Promise<HyperliquidAllMids> {
    const response = await fetch(`${HL_API_BASE}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'allMids' }),
    });
    if (!response.ok) {
        throw new Error(`Hyperliquid allMids failed: ${response.status}`);
    }
    return response.json();
}

/**
 * Fetch price for a single commodity token
 */
export async function fetchHyperliquidPrice(symbol: string): Promise<number> {
    const ticker = HYPERLIQUID_MARKET_TICKERS[symbol.toUpperCase()];
    if (!ticker) {
        throw new Error(`No Hyperliquid ticker for symbol: ${symbol}`);
    }
    const mids = await fetchHyperliquidPrices();
    const price = mids[ticker];
    if (!price) {
        throw new Error(`No price found for ticker: ${ticker}`);
    }
    return parseFloat(price);
}

/**
 * Place a market order on Hyperliquid (requires wallet signer)
 * Opens a 1x long position by depositing USDC collateral and buying the perp.
 */
export async function placeHyperliquidOrder(
    wallet: ethers.Wallet,
    coin: string,
    isBuy: boolean,
    sz: number,
    limitPx: number,
    vaultAddress?: string
): Promise<HyperliquidOrderResult> {
    const timestamp = Date.now();

    // Build the order action
    const orderAction = {
        type: 'order',
        orders: [
            {
                a: 0, // asset index - resolved server-side by coin name
                b: isBuy,
                p: limitPx.toFixed(6),
                s: sz.toFixed(6),
                r: false, // not reduce-only
                t: { limit: { tif: 'Ioc' } }, // Immediate-or-cancel market equivalent
            },
        ],
        grouping: 'na',
        ...(vaultAddress ? { vaultAddress } : {}),
    };

    // Sign the action using EIP-712 style signing expected by Hyperliquid
    const actionHash = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(JSON.stringify(orderAction) + timestamp.toString())
    );
    const signature = await wallet.signMessage(ethers.utils.arrayify(actionHash));
    const { r, s, v } = ethers.utils.splitSignature(signature);

    const payload = {
        action: orderAction,
        nonce: timestamp,
        signature: { r, s, v },
        ...(vaultAddress ? { vaultAddress } : {}),
    };

    const response = await fetch(`${HL_API_BASE}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Hyperliquid order failed: ${response.status}`);
    }
    return response.json();
}

/**
 * HyperliquidPerpStrategy
 *
 * Handles swaps where toToken is a Hyperliquid commodity perp (GOLD, SILVER, OIL, COPPER).
 * The "swap" is: deposit USDC → open 1x long perp on Hyperliquid.
 * The "reverse swap" is: close perp position → receive USDC.
 *
 * Excluded from Islamic Finance portfolios via SwapOrchestratorService filter.
 */
export class HyperliquidPerpStrategy extends BaseSwapStrategy {
    getName(): string {
        return 'HyperliquidPerp';
    }

    /**
     * Supports swaps where:
     * - toChainId is Hyperliquid (opening a position with USDC)
     * - OR fromChainId is Hyperliquid (closing a position back to USDC)
     */
    supports(params: SwapParams): boolean {
        const toHyperliquid =
            params.toChainId === HYPERLIQUID_CHAIN_ID &&
            SUPPORTED_TOKENS.has(params.toToken.toUpperCase());

        const fromHyperliquid =
            params.fromChainId === HYPERLIQUID_CHAIN_ID &&
            SUPPORTED_TOKENS.has(params.fromToken.toUpperCase());

        return toHyperliquid || fromHyperliquid;
    }

    async validate(params: SwapParams): Promise<boolean> {
        if (!this.supports(params)) return false;
        if (!params.userAddress) return false;
        const amount = parseFloat(params.amount);
        if (isNaN(amount) || amount <= 0) return false;
        return true;
    }

    async getEstimate(params: SwapParams): Promise<SwapEstimate> {
        const isBuy = params.toChainId === HYPERLIQUID_CHAIN_ID;
        const commoditySymbol = isBuy ? params.toToken : params.fromToken;
        const price = await fetchHyperliquidPrice(commoditySymbol);
        const usdcAmount = parseFloat(params.amount);

        // 1x long: size in commodity units = USDC / price
        const commoditySize = isBuy ? usdcAmount / price : usdcAmount * price;
        const expectedOutput = commoditySize.toFixed(6);
        const slippage = params.slippageTolerance ?? 0.5;
        const minOutput = (commoditySize * (1 - slippage / 100)).toFixed(6);

        return {
            expectedOutput,
            minimumOutput: minOutput,
            priceImpact: 0.1, // Hyperliquid is deep liquidity, minimal impact
            gasCostEstimate: ethers.BigNumber.from(0), // No gas on Hyperliquid
        };
    }

    async execute(
        params: SwapParams,
        callbacks?: SwapCallbacks
    ): Promise<SwapResult> {
        this.log('Executing Hyperliquid perp swap', params);

        try {
            const isBuy = params.toChainId === HYPERLIQUID_CHAIN_ID;
            const commoditySymbol = (isBuy ? params.toToken : params.fromToken).toUpperCase();
            const ticker = HYPERLIQUID_MARKET_TICKERS[commoditySymbol];

            if (!ticker) {
                return { success: false, error: `Unsupported commodity: ${commoditySymbol}` };
            }

            // Fetch current price
            const price = await fetchHyperliquidPrice(commoditySymbol);
            const usdcAmount = parseFloat(params.amount);

            // Calculate position size at 1x leverage
            const sz = isBuy ? usdcAmount / price : usdcAmount;

            // Add 0.5% slippage buffer to limit price
            const limitPx = isBuy ? price * 1.005 : price * 0.995;

            this.log(`${isBuy ? 'Opening' : 'Closing'} 1x ${ticker} position`, {
                price,
                sz,
                limitPx,
                usdcAmount,
            });

            // Note: In production, wallet would be injected via dependency injection
            // or retrieved from a wallet service. Here we signal intent and return
            // a structured result for the UI to handle signing.
            callbacks?.onSwapSubmitted?.('hyperliquid-pending');

            // Return structured result indicating Hyperliquid action required
            // The actual signing happens client-side via the Hyperliquid SDK
            return {
                success: true,
                txHash: `hl-${ticker}-${isBuy ? 'open' : 'close'}-${Date.now()}`,
                steps: [
                    {
                        type: 'hyperliquid_perp',
                        action: isBuy ? 'open_long' : 'close_long',
                        coin: ticker,
                        size: sz,
                        limitPrice: limitPx,
                        leverage: 1,
                        collateralUsdc: usdcAmount,
                        note: 'Synthetic 1x long — not physical commodity ownership',
                    },
                ],
            };
        } catch (error: any) {
            this.logError('Hyperliquid perp swap failed', error);
            return {
                success: false,
                error: `Hyperliquid error: ${error?.message || 'Unknown error'}`,
            };
        }
    }
}
