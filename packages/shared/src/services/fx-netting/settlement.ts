/**
 * FX Netting — settlement plan generator. Pure functions, no I/O.
 *
 * Takes a NettingResult (from matching-engine.ts) and produces a
 * SettlementPlan: the ledger-anchor params for each match (so the API
 * route can call recommendationLedgerService.recordRecommendation) +
 * cUSD transfer instructions for each net obligation + residual routing
 * for unmatched intents.
 *
 * Settlement currency is USD-pegged stablecoin (cUSD on Celo) for regions
 * without a native onchain stabletoken (Caribbean, most of Africa). The
 * RecommendationLedger is deployed at the same address on
 * Celo/Arbitrum/HashKey/0G, so the API route anchors each match on the
 * region's canonical chain — detected from the matched currency pair via
 * fxRegionForCurrency (Africa/Caribbean/LatAm → Celo, APAC → HashKey).
 */

import type { NettingResult, FxMatch, NetObligation, FxIntent } from './intent';
import { fxRegionForCurrency, type FxRegion } from '../fx-drag/regions';

/** Ledger-anchor params for a single match — mirrors recordRecommendation's args. */
export interface MatchAnchorParams {
    user: string;
    action: string;
    targetToken: string;
    reasoning: string;
    evidenceCid: string;
    servingModel: string;
    confidence: number;
    /** Region-canonical chain id (the API route passes this as chainId). */
    chainId?: number;
}

/** A cUSD transfer instruction for a net obligation. */
export interface SettlementTransfer {
    fromParticipant: string;
    toParticipant: string;
    settlementCurrency: string;
    netAmount: number;
    /** The chain to settle on (Celo for Caribbean). */
    chainId: number;
    sourceMatchIds: string[];
}

/** Fallback routing for an unmatched intent (→ external rail / swap orchestrator). */
export interface ResidualRoute {
    intent: FxIntent;
    recommendation: string;
}

/** Complete settlement plan for the API route to execute. */
export interface SettlementPlan {
    /** One ledger anchor per match (fire-and-forget, like x402-gateway FX anchor). */
    matchAnchors: MatchAnchorParams[];
    /** Net cUSD transfers to execute (only non-zero obligations). */
    transfers: SettlementTransfer[];
    /** Unmatched intents that need fallback routing. */
    residuals: ResidualRoute[];
    /** Summary for the response. */
    summary: {
        totalMatchedUsd: number;
        totalSavingsUsd: number;
        matchCount: number;
        transferCount: number;
        residualCount: number;
    };
}

/** Config for settlement plan generation. */
export interface SettlementConfig {
    /** Settlement currency (default 'cUSD'). */
    settlementCurrency: string;
    /** Chain to settle net obligations on (default 42220 = Celo mainnet). */
    settlementChainId: number;
    /** Chain to anchor match records on (default 42220 = Celo — Caribbean rail). */
    anchorChainId: number;
    /** Evidence CID for the match reasoning (0G Storage — set by the API route). */
    evidenceCid?: string;
}

export const DEFAULT_SETTLEMENT_CONFIG: SettlementConfig = {
    settlementCurrency: 'cUSD',
    settlementChainId: 42220,   // Celo mainnet (default for Africa/Caribbean/LatAm)
    anchorChainId: 42220,       // Celo — overridden per-match by region detection
};

/**
 * Build a settlement plan from a netting result. Pure — no I/O.
 * The API route executes the plan (ledger anchors + transfers).
 */
export function buildSettlementPlan(
    result: NettingResult,
    config: SettlementConfig = DEFAULT_SETTLEMENT_CONFIG,
): SettlementPlan {
    const matchAnchors: MatchAnchorParams[] = result.matches.map((m) =>
        matchToAnchor(m, config),
    );

    const transfers: SettlementTransfer[] = result.netObligations.map((ob) =>
        obligationToTransfer(ob, config),
    );

    const residuals: ResidualRoute[] = result.unmatchedIntents.map((intent) =>
        intentToResidual(intent),
    );

    return {
        matchAnchors,
        transfers,
        residuals,
        summary: {
            totalMatchedUsd: result.totalMatchedUsd,
            totalSavingsUsd: result.totalSavingsUsd,
            matchCount: result.matches.length,
            transferCount: transfers.length,
            residualCount: residuals.length,
        },
    };
}

/** Region label for anchor reasoning (human-readable). */
function regionLabel(region: FxRegion): string {
    switch (region) {
        case 'africa': return 'Africa';
        case 'caribbean': return 'Caribbean (CARICOM)';
        case 'asia': return 'APAC';
        case 'latam': return 'LatAm';
        default: return 'cross-region';
    }
}

/** Canonical anchor chain for a region (mirrors FX_ANCHOR_CHAIN_BY_REGION in x402-gateway). */
function anchorChainForRegion(region: FxRegion): number | undefined {
    switch (region) {
        case 'asia': return 177;       // HashKey — APAC rail
        case 'africa': return 42220;   // Celo — Africa / EM savings ledger
        case 'latam': return 42220;    // Celo — LatAm shares the EM ledger
        case 'caribbean': return 42220; // Celo — Caribbean rail
        default: return undefined;      // default routing (Arbitrum)
    }
}

/**
 * Detect the dominant region for a match — the region of the sell currency.
 * If both currencies are in the same region, that's unambiguous. If they
 * differ (cross-region match), we use the sell currency's region and label
 * it "cross-region" in the reasoning.
 */
function matchRegion(match: FxMatch): { region: FxRegion; label: string } {
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

function matchToAnchor(m: FxMatch, config: SettlementConfig): MatchAnchorParams {
    const a = m.intentA;
    const { region, label } = matchRegion(m);
    const anchorChain = anchorChainForRegion(region) ?? config.anchorChainId;
    return {
        user: a.participantId,
        action: 'FX_MATCH',
        targetToken: config.settlementCurrency,
        reasoning: `FX netting (${label}): matched ${m.matchedAmount} ${a.sellCurrency}↔${a.buyCurrency} at mid-market ${m.rate.toFixed(4)} (no USD bridge). Saved ~$${(m.notionalUsd * m.savingsBps / 10_000).toFixed(0)} vs ${m.savingsBps / 100}% corridor.`,
        evidenceCid: config.evidenceCid ?? '',
        servingModel: 'fx-netting/v1',
        confidence: 9000,
        chainId: anchorChain,
    };
}

function obligationToTransfer(ob: NetObligation, config: SettlementConfig): SettlementTransfer {
    return {
        fromParticipant: ob.fromParticipant,
        toParticipant: ob.toParticipant,
        settlementCurrency: ob.settlementCurrency,
        netAmount: ob.netAmount,
        chainId: config.settlementChainId,
        sourceMatchIds: ob.sourceMatchIds,
    };
}

function intentToResidual(intent: FxIntent): ResidualRoute {
    return {
        intent,
        recommendation: `Unmatched: ${intent.remainingSell.toFixed(0)} ${intent.sellCurrency} → ${intent.buyCurrency}. Route via external rail (Mento/LiFi) or hold for next matching cycle.`,
    };
}
