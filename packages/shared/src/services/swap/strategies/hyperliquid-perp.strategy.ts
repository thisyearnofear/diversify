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
 * - Uses Hyperliquid Exchange API for order placement (requires EIP-712 signed actions)
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

// EIP-712 domain for Hyperliquid user-signed actions (mainnet)
export const HYPERLIQUID_EIP712_DOMAIN = {
    name: 'HyperliquidSignTransaction',
    version: '1',
    chainId: 0x66eee, // 421614
    verifyingContract: '0x0000000000000000000000000000000000000000' as const,
};

// EIP-712 types for order actions
export const HYPERLIQUID_ORDER_TYPES = {
    'HyperliquidTransaction:Order': [
        { name: 'grouping', type: 'string' },
        { name: 'orders', type: 'string' },
        { name: 'nonce', type: 'uint64' },
    ],
};

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

export interface HyperliquidPosition {
    coin: string;
    szi: string;
    entryPx: string;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string | null;
    leverage: { type: string; value: number };
    marginUsed: string;
    maxLeverage: number;
}

export interface HyperliquidUserState {
    assetPositions: Array<{
        position: HyperliquidPosition;
        type: string;
    }>;
    crossMarginSummary: {
        accountValue: string;
        totalMarginUsed: string;
        totalNtlPos: string;
        totalRawUsd: string;
    };
    marginSummary: {
        accountValue: string;
        totalMarginUsed: string;
        totalNtlPos: string;
        totalRawUsd: string;
    };
    withdrawable: string;
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
 * Fetch market metadata (asset indices, size decimals, max leverage)
 */
export async function fetchHyperliquidMeta(): Promise<HyperliquidMeta> {
    const response = await fetch(`${HL_API_BASE}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meta' }),
    });
    if (!response.ok) {
        throw new Error(`Hyperliquid meta failed: ${response.status}`);
    }
    return response.json();
}

/**
 * Fetch user's open positions and account state
 */
export async function fetchHyperliquidUserState(userAddress: string): Promise<HyperliquidUserState> {
    const response = await fetch(`${HL_API_BASE}/info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'clearinghouseState', user: userAddress }),
    });
    if (!response.ok) {
        throw new Error(`Hyperliquid user state failed: ${response.status}`);
    }
    return response.json();
}

/**
 * Resolve asset index from coin name using meta endpoint
 */
export async function resolveAssetIndex(coin: string): Promise<number> {
    const meta = await fetchHyperliquidMeta();
    const idx = meta.universe.findIndex(m => m.name === coin);
    if (idx === -1) {
        throw new Error(`Asset not found in Hyperliquid universe: ${coin}`);
    }
    return idx;
}

/**
 * Get size decimals for a given coin
 */
export async function getSzDecimals(coin: string): Promise<number> {
    const meta = await fetchHyperliquidMeta();
    const market = meta.universe.find(m => m.name === coin);
    if (!market) {
        throw new Error(`Market not found: ${coin}`);
    }
    return market.szDecimals;
}

/**
 * Round size to the correct number of decimals for a market
 */
export function roundSize(sz: number, szDecimals: number): string {
    const factor = Math.pow(10, szDecimals);
    return (Math.floor(sz * factor) / factor).toFixed(szDecimals);
}

/**
 * Round price to 6 significant figures (Hyperliquid convention)
 */
export function roundPrice(px: number): string {
    return parseFloat(px.toPrecision(6)).toString();
}

/**
 * Sign an order action using EIP-712 typed data signing
 */
export async function signOrderAction(
    signer: ethers.Signer,
    orderAction: Record<string, unknown>,
    nonce: number
): Promise<{ r: string; s: string; v: number }> {
    const message = {
        grouping: (orderAction as any).grouping || 'na',
        orders: JSON.stringify((orderAction as any).orders),
        nonce,
    };

    const signature = await (signer as any)._signTypedData(
        HYPERLIQUID_EIP712_DOMAIN,
        HYPERLIQUID_ORDER_TYPES,
        message
    );

    return ethers.utils.splitSignature(signature);
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
 * Uses proper EIP-712 signing as required by Hyperliquid's exchange API.
 */
export async function placeHyperliquidOrder(
    signer: ethers.Signer,
    coin: string,
    isBuy: boolean,
    sz: number,
    limitPx: number,
    vaultAddress?: string
): Promise<HyperliquidOrderResult> {
    const nonce = Date.now();

    // Resolve asset index from meta
    const assetIndex = await resolveAssetIndex(coin);
    const szDecimals = await getSzDecimals(coin);

    // Build the order action
    const orderAction = {
        type: 'order',
        orders: [
            {
                a: assetIndex,
                b: isBuy,
                p: roundPrice(limitPx),
                s: roundSize(sz, szDecimals),
                r: false, // not reduce-only
                t: { limit: { tif: 'Ioc' } }, // Immediate-or-cancel market equivalent
            },
        ],
        grouping: 'na',
        ...(vaultAddress ? { vaultAddress } : {}),
    };

    // Sign using EIP-712
    const signature = await signOrderAction(signer, orderAction, nonce);

    const payload = {
        action: orderAction,
        nonce,
        signature: { r: signature.r, s: signature.s, v: signature.v },
        ...(vaultAddress ? { vaultAddress } : {}),
    };

    const response = await fetch(`${HL_API_BASE}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hyperliquid order failed (${response.status}): ${errorText}`);
    }
    return response.json();
}

/**
 * Close an existing position (reduce-only order)
 */
export async function closeHyperliquidPosition(
    signer: ethers.Signer,
    coin: string,
    currentSize: number,
    currentPrice: number
): Promise<HyperliquidOrderResult> {
    const nonce = Date.now();
    const isBuy = currentSize < 0;
    const sz = Math.abs(currentSize);
    const limitPx = isBuy ? currentPrice * 1.005 : currentPrice * 0.995;

    const assetIndex = await resolveAssetIndex(coin);
    const szDecimals = await getSzDecimals(coin);

    const orderAction = {
        type: 'order',
        orders: [
            {
                a: assetIndex,
                b: isBuy,
                p: roundPrice(limitPx),
                s: roundSize(sz, szDecimals),
                r: true, // reduce-only for closing
                t: { limit: { tif: 'Ioc' } },
            },
        ],
        grouping: 'na',
    };

    const signature = await signOrderAction(signer, orderAction, nonce);

    const payload = {
        action: orderAction,
        nonce,
        signature: { r: signature.r, s: signature.s, v: signature.v },
    };

    const response = await fetch(`${HL_API_BASE}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Hyperliquid close failed (${response.status}): ${errorText}`);
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
    private signer: ethers.Signer | null = null;

    getName(): string {
        return 'HyperliquidPerp';
    }

    setSigner(signer: ethers.Signer): void {
        this.signer = signer;
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
        if (amount < 10) return false; // Hyperliquid minimum order value
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

            if (usdcAmount < 10) {
                return { success: false, error: 'Minimum order value is $10' };
            }

            // Calculate position size at 1x leverage
            const sz = isBuy ? usdcAmount / price : usdcAmount;

            // Add slippage buffer to limit price
            const slippage = params.slippageTolerance ?? 0.5;
            const slippageMultiplier = slippage / 100;
            const limitPx = isBuy
                ? price * (1 + slippageMultiplier)
                : price * (1 - slippageMultiplier);

            this.log(`${isBuy ? 'Opening' : 'Closing'} 1x ${ticker} position`, {
                price,
                sz,
                limitPx,
                usdcAmount,
            });

            callbacks?.onSwapSubmitted?.('hyperliquid-pending');

            // If we have a signer, execute the order directly via Hyperliquid API
            if (this.signer) {
                try {
                    let result: HyperliquidOrderResult;
                    if (isBuy) {
                        result = await placeHyperliquidOrder(
                            this.signer, ticker, true, sz, limitPx
                        );
                    } else {
                        result = await closeHyperliquidPosition(
                            this.signer, ticker, sz, price
                        );
                    }

                    const status = result.response?.data?.statuses?.[0];
                    if (status?.filled) {
                        const txId = `hl-${ticker}-${status.filled.oid}`;
                        callbacks?.onSwapSubmitted?.(txId);
                        return {
                            success: true,
                            txHash: txId,
                            steps: [{
                                type: 'hyperliquid_perp',
                                action: isBuy ? 'open_long' : 'close_long',
                                coin: ticker,
                                filledSize: status.filled.totalSz,
                                avgPrice: status.filled.avgPx,
                                orderId: status.filled.oid,
                                leverage: 1,
                                collateralUsdc: usdcAmount,
                            }],
                        };
                    } else if (status?.resting) {
                        return {
                            success: true,
                            txHash: `hl-${ticker}-${status.resting.oid}`,
                            steps: [{
                                type: 'hyperliquid_perp',
                                action: isBuy ? 'open_long' : 'close_long',
                                coin: ticker,
                                orderId: status.resting.oid,
                                status: 'resting',
                                leverage: 1,
                                collateralUsdc: usdcAmount,
                            }],
                        };
                    } else if (status?.error) {
                        return { success: false, error: `Hyperliquid: ${status.error}` };
                    }

                    return { success: false, error: 'Order returned unknown status' };
                } catch (orderError: any) {
                    this.logError('Direct order execution failed', orderError);
                    return {
                        success: false,
                        error: `Hyperliquid order error: ${orderError?.message || 'Unknown error'}`,
                    };
                }
            }

            // No signer — return structured result for client-side signing
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
                        requiresClientSigning: true,
                        signingDomain: HYPERLIQUID_EIP712_DOMAIN,
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
