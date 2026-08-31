/**
 * Multi-region FX matching & net-settlement engine. Pure functions, no I/O —
 * callers wire in a mid-rate function (the API route uses the same
 * rate provider as fx-drag/rates-serverless.ts) and settlement.
 *
 * Originally built for the Caribbean (CARICOM) FX coordination layer, now
 * generalized to any region: matches opposing currency needs directly,
 * nets obligations across participants, and settles only the net — removing
 * USD as the default bridge for regional trade (BBD ↔ JMD, GHS ↔ NGN,
 * XOF ↔ XAF, etc.).
 *
 * Algorithm:
 *   1. matchIntents()     — find opposing intent pairs, settle at mid-market
 *   2. computeNetObligations() — collapse pairwise matches into net per-pair
 *       obligations in the settlement currency (cUSD on Celo)
 *
 * Pure & deterministic: given the same intents + rate function, the output
 * is identical. The API route handles persistence, wallet auth, and ledger
 * anchoring (reusing recommendationLedgerService + 0G evidence).
 */

import {
    type FxIntent,
    type FxMatch,
    type NetObligation,
    type NettingResult,
    type MidRateFn,
    type CurrencyCode,
    DEFAULT_CORRIDOR_COST_BPS,
} from './intent';
import {
    canonicalChainForRegion,
    settlementCurrencyForChain,
    matchRegionOf,
    DEFAULT_SETTLEMENT_CHAIN_ID,
} from './settlement-rails';

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Whether an intent is still live (open, unexpired, has remaining volume). */
function isLive(intent: FxIntent, now: number): boolean {
    return (
        (intent.status === 'open' || intent.status === 'partially_matched') &&
        intent.remainingSell > 0.005 &&
        (intent.deadline === 0 || intent.deadline >= now)
    );
}

/** Convert an amount of one currency to another via the injected mid-rate. */
function convert(amount: number, from: CurrencyCode, to: CurrencyCode, midRate: MidRateFn): number {
    if (from === to) return amount;
    return amount * midRate(from, to);
}

/**
 * USD notional of a matched amount — used for savings reporting and
 * institutional dashboards. Falls back to 0 if no USD rate is available
 * (the function never throws).
 */
function notionalUsd(amount: number, currency: CurrencyCode, midRate: MidRateFn): number {
    try {
        const usdPerUnit = midRate(currency, 'USD');
        if (!isFinite(usdPerUnit) || usdPerUnit <= 0) return 0;
        return amount * usdPerUnit;
    } catch {
        return 0;
    }
}

/** Savings in USD vs the traditional corridor, given a matched USD notional. */
function savingsUsd(notional: number, corridorCostBps: number): number {
    return (notional * corridorCostBps) / 10_000;
}

// ─── Pairwise matching ───────────────────────────────────────────────────

/**
 * Match opposing intents pairwise. For each open intent A (sell X → buy Y),
 * find intents B (sell Y → buy X) whose deadlines overlap and amounts can be
 * partially or fully filled. Settlement is at mid-market (no spread).
 *
 * This is O(n²) — fine for a hackathon prototype with hundreds of intents.
 * A production system would bucket by currency pair and use an order book.
 *
 * The function does NOT mutate the input intents — it returns a working
 * copy with updated `remainingSell` / `status` fields alongside the matches.
 */
export function matchIntents(
    intents: readonly FxIntent[],
    midRate: MidRateFn,
    now: number = Date.now(),
    corridorCostBps: number = DEFAULT_CORRIDOR_COST_BPS,
): { matches: FxMatch[]; residualIntents: FxIntent[] } {
    // Work on copies — never mutate the caller's array
    const pool: FxIntent[] = intents.map((i) => ({ ...i }));
    const matches: FxMatch[] = [];

    for (let i = 0; i < pool.length; i++) {
        const a = pool[i];
        if (!isLive(a, now)) continue;

        for (let j = i + 1; j < pool.length; j++) {
            const b = pool[j];
            if (!isLive(b, now)) continue;
            // Skip same participant (no self-matching)
            if (a.participantId === b.participantId) continue;

            // Opposing pair? A sells X buys Y; B sells Y buys X
            if (a.sellCurrency !== b.buyCurrency || a.buyCurrency !== b.sellCurrency) continue;

            // Mid-market rate: units of A's buy currency per 1 A's sell currency
            const rate = midRate(a.sellCurrency, a.buyCurrency);
            if (!isFinite(rate) || rate <= 0) continue;

            // matchedAmount is in A's sellCurrency. B's capacity must be
            // converted to A's sellCurrency before taking the min: B can
            // sell at most b.remainingSell (in B's currency), which equals
            // b.remainingSell / rate in A's sellCurrency.
            const bCapacityInA = b.remainingSell / rate;
            const matchedAmount = Math.min(a.remainingSell, bCapacityInA);
            if (matchedAmount <= 0.005) continue;

            // Verify both sides' min-accept constraints (proportional for partial fills)
            const aReceives = matchedAmount * rate;
            const bReceives = matchedAmount;
            const aRatio = matchedAmount / a.sellAmount;
            const bRatio = (matchedAmount * rate) / b.sellAmount;
            if (a.buyAmountMin != null && aReceives < a.buyAmountMin * aRatio) continue;
            if (b.buyAmountMin != null && bReceives < b.buyAmountMin * bRatio) continue;

            const usdNotional = notionalUsd(matchedAmount, a.sellCurrency, midRate);

            matches.push({
                matchId: nextMatchId(),
                intentA: { ...a },
                intentB: { ...b },
                matchedAmount,
                rate,
                savingsBps: corridorCostBps,
                notionalUsd: usdNotional,
            });

            // Update residuals — each in its OWN sellCurrency.
            // A's sell currency = matchedAmount's currency (direct).
            // B's sell currency = A's buy currency (convert via rate).
            a.remainingSell -= matchedAmount;
            a.status = a.remainingSell > 0.005 ? 'partially_matched' : 'matched';
            const bFilled = matchedAmount * rate;
            b.remainingSell -= bFilled;
            b.status = b.remainingSell > 0.005 ? 'partially_matched' : 'matched';
        }
    }

    // Mark expired intents
    for (const intent of pool) {
        if (isLive(intent, now) && intent.deadline !== 0 && intent.deadline < now) {
            intent.status = 'expired';
        }
    }

    return { matches, residualIntents: pool };
}

let _matchSeq = 0;
function nextMatchId(): string {
    _matchSeq += 1;
    return `fxmatch_${Date.now()}_${_matchSeq}`;
}

// ─── Net settlement ──────────────────────────────────────────────────────

/**
 * Collapse all pairwise matches into net obligations per participant pair,
 * denominated in the region-canonical settlement currency (cUSD on Celo,
 * USDT on HashKey — settlement-rails.ts). This is the track's
 * "Net Settlement Layer": "Aggregates transactions across multiple parties;
 * settles only net obligations between institutions; reduces capital
 * requirements and liquidity strain."
 *
 * For each match, we compute what each participant owes the other in the
 * settlement currency, then net the two directions — only the net debtor
 * pays the net creditor.
 *
 * Matches are grouped by their region-canonical settlement chain BEFORE
 * netting: an APAC pair nets in USDT on HashKey, an African/Caribbean pair
 * nets in cUSD on Celo. A participant pair whose matched flows span rails
 * gets one obligation per chain — flows on different chains are never
 * netted together (that would ask someone to pre-fund the wrong rail).
 */
export function computeNetObligations(
    matches: readonly FxMatch[],
    settlementCurrency: string,
    midRate: MidRateFn,
): NetObligation[] {
    // Group matches by settlement chain, then net within each group.
    const byChain = new Map<number, FxMatch[]>();
    for (const m of matches) {
        const { region } = matchRegionOf(m);
        const chainId =
            canonicalChainForRegion(region) ?? DEFAULT_SETTLEMENT_CHAIN_ID;
        const group = byChain.get(chainId);
        if (group) group.push(m);
        else byChain.set(chainId, [m]);
    }

    const obligations: NetObligation[] = [];
    for (const [chainId, chainMatches] of byChain) {
        const currency = settlementCurrencyForChain(chainId) ?? settlementCurrency;
        obligations.push(...netMatchesOnChain(chainMatches, currency, chainId, midRate));
    }
    return obligations;
}

function netMatchesOnChain(
    matches: readonly FxMatch[],
    settlementCurrency: string,
    chainId: number,
    midRate: MidRateFn,
): NetObligation[] {
    // Accumulate gross obligations: who owes whom, in settlement currency.
    const ledger = new Map<string, { amount: number; matchIds: string[] }>();

    for (const m of matches) {
        const a = m.intentA;
        const b = m.intentB;

        // A delivers sellCurrency-value; B delivers buyCurrency-value.
        // Both converted to settlement currency at mid-market.
        const aDelivers = convert(m.matchedAmount, a.sellCurrency, settlementCurrency, midRate);
        const bDelivers = convert(m.matchedAmount * m.rate, a.buyCurrency, settlementCurrency, midRate);

        // netFlow > 0 means A owes B; < 0 means B owes A
        addObligation(ledger, a.participantId, b.participantId, aDelivers - bDelivers, m.matchId);
    }

    // Convert ledger to NetObligation[] — only non-zero net amounts
    const obligations: NetObligation[] = [];
    for (const [key, val] of ledger) {
        if (Math.abs(val.amount) < 0.005) continue; // settled — no net flow
        const [from, to] = key.split('>');
        obligations.push({
            fromParticipant: val.amount > 0 ? from : to,
            toParticipant: val.amount > 0 ? to : from,
            settlementCurrency,
            netAmount: Math.abs(val.amount),
            chainId,
            sourceMatchIds: val.matchIds,
        });
    }

    return obligations;
}

function addObligation(
    ledger: Map<string, { amount: number; matchIds: string[] }>,
    a: string,
    b: string,
    netFlow: number,
    matchId: string,
): void {
    // Canonical pair key (lowercased, ordered) so A→B and B→A flows NET
    // against each other — the whole point of the net settlement layer.
    const ordered =
        a.toLowerCase() <= b.toLowerCase()
            ? { key: `${a}>${b}`, flow: netFlow }
            : { key: `${b}>${a}`, flow: -netFlow };
    const existing = ledger.get(ordered.key) ?? { amount: 0, matchIds: [] };
    existing.amount += ordered.flow;
    existing.matchIds.push(matchId);
    ledger.set(ordered.key, existing);
}

// ─── Full pipeline ───────────────────────────────────────────────────────

/**
 * Run the full matching + netting pipeline. The single entry point for the
 * API route: feed in open intents, get back matches, net obligations, and
 * unmatched residuals.
 */
export function runNetting(
    intents: readonly FxIntent[],
    midRate: MidRateFn,
    settlementCurrency: string = 'cUSD',
    now: number = Date.now(),
    corridorCostBps: number = DEFAULT_CORRIDOR_COST_BPS,
): NettingResult {
    const { matches, residualIntents } = matchIntents(intents, midRate, now, corridorCostBps);
    const netObligations = computeNetObligations(matches, settlementCurrency, midRate);

    const totalMatchedUsd = matches.reduce((s, m) => s + m.notionalUsd, 0);
    const totalSavingsUsd = matches.reduce((s, m) => s + savingsUsd(m.notionalUsd, m.savingsBps), 0);
    const unmatchedIntents = residualIntents.filter(
        (i) => i.status === 'open' || i.status === 'partially_matched',
    );

    return { matches, netObligations, unmatchedIntents, totalMatchedUsd, totalSavingsUsd };
}

// ─── Intent construction helper ──────────────────────────────────────────

/** Build a new open intent with sensible defaults. */
export function createIntent(
    intentId: string,
    participantId: string,
    sellCurrency: CurrencyCode,
    sellAmount: number,
    buyCurrency: CurrencyCode,
    buyAmountMin: number | null = null,
    deadline: number = 0,
): FxIntent {
    return {
        intentId,
        participantId,
        sellCurrency,
        sellAmount,
        buyCurrency,
        buyAmountMin,
        deadline,
        remainingSell: sellAmount,
        status: 'open',
        createdAt: Date.now(),
    };
}

