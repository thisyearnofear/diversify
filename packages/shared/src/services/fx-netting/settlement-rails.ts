/**
 * FX Netting — settlement rails. Pure data, no I/O.
 *
 * Single source of truth for WHERE a region's net obligations settle and in
 * WHICH settlement currency. Mirrors FX_ANCHOR_CHAIN_BY_REGION in
 * x402-gateway so the matching engine, the match anchors, and the settle
 * route all agree on "the money settles on the chain where the region lives".
 *
 * Chain → currency (all verified on-chain, 6 decimals):
 *   - Celo 42220 → cUSD (Mento, native regional stabletoken chain)
 *   - HashKey 177 → USDT (canonical stablecoin on HashKey — no native USDC;
 *     the bridged token's on-chain symbol is USDC.e)
 *   - Arbitrum 42161 → USDC (default/cross-region rail)
 */

import type { FxRegion } from '../fx-drag/regions';
import type { FxMatch } from './intent';
import { fxRegionForCurrency } from '../fx-drag/regions';

/** Region label for anchor/settlement reasoning (human-readable). */
export function regionLabel(region: FxRegion): string {
    switch (region) {
        case 'africa': return 'Africa';
        case 'caribbean': return 'Caribbean (CARICOM)';
        case 'asia': return 'APAC';
        case 'latam': return 'LatAm';
        default: return 'cross-region';
    }
}

/**
 * Detect the dominant region for a match — the region of the sell currency.
 * If both currencies are in the same region, that's unambiguous. If they
 * differ (cross-region match), we use the sell currency's region and label
 * it "cross-region" in the reasoning.
 */
export function matchRegionOf(match: FxMatch): { region: FxRegion; label: string } {
    const sellRegion = fxRegionForCurrency(match.intentA.sellCurrency);
    const buyRegion = fxRegionForCurrency(match.intentA.buyCurrency);
    if (sellRegion === buyRegion && sellRegion !== 'other') {
        return { region: sellRegion, label: regionLabel(sellRegion) };
    }
    // Cross-region match — use sell currency's region for chain routing
    if (sellRegion !== 'other') {
        return { region: sellRegion, label: `cross-region (${regionLabel(sellRegion)}→${regionLabel(buyRegion)})` };
    }
    return { region: 'other', label: regionLabel('other') };
}

/** Region-canonical settlement chain (undefined = fall back to caller default). */
export function canonicalChainForRegion(region: FxRegion): number | undefined {
    switch (region) {
        case 'asia': return 177;        // HashKey — APAC rail
        case 'africa': return 42220;    // Celo — Africa / EM savings ledger
        case 'latam': return 42220;     // Celo — LatAm shares the EM ledger
        case 'caribbean': return 42220; // Celo — Caribbean rail
        default: return undefined;      // caller default (Celo 42220)
    }
}

/** Settlement currency for a chain (Arbitrum USDC is the default rail token). */
export function settlementCurrencyForChain(chainId: number): string {
    switch (chainId) {
        case 42220: return 'cUSD';
        case 177: return 'USDT';
        default: return 'USDC';
    }
}

/**
 * Default settlement chain when no region rules apply ('other' currencies,
 * cross-rate fallbacks): Celo mainnet — the EM savings home rail.
 */
export const DEFAULT_SETTLEMENT_CHAIN_ID = 42220;
