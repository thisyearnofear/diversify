/**
 * POST /api/fx-netting/match — Multi-region FX matching + net settlement
 * against the HOSTED intent pool.
 *
 * Any intents supplied in the body (e.g. the card's just-submitted intent)
 * are upserted into the pool first; the run then loads the full open pool,
 * matches at live mid-market rates, and PERSISTS the outcomes (remainingSell
 * decrements, status advances, matchId audit trail) — so an intent posted
 * today can be matched by a counterparty tomorrow.
 *
 * Anchors each match to the RecommendationLedger on the matched currency
 * pair's region-canonical chain (Celo for Africa/Caribbean/LatAm, HashKey
 * for APAC) — fire-and-forget, same pattern as the x402-gateway FX
 * Protection Insight anchor.
 *
 * Body: { intents?: FxIntent[] }  (optional — an empty body matches the pool as-is)
 * Response: { matches, netObligations, unmatchedIntents, settlementPlan,
 *             totalMatchedUsd, totalSavingsUsd, rateSourceNote, rateDate, poolSize }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import connectDB from '@/lib/mongodb';
import { FxIntentRecord } from '@/models/FxIntentRecord';
import {
    loadOpenPool,
    upsertPoolIntent,
    persistMatchOutcomes,
} from '@/lib/fx-intent-pool';
import { isObserverIntent } from '@/hooks/use-fx-netting';
import {
    runNetting,
} from '@diversifi/shared/src/services/fx-netting/matching-engine';
import { buildSettlementPlan } from '@diversifi/shared/src/services/fx-netting/settlement';
import { buildLiveRateProvider } from '@diversifi/shared/src/services/fx-netting/rate-adapter';
import { buildStandingIntents } from '@diversifi/shared/src/services/fx-netting/liquidity-bootstrap';
import type { FxIntent } from '@diversifi/shared/src/services/fx-netting/intent';

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

interface MatchResponse {
    ok: true;
    matches: ReturnType<typeof runNetting>['matches'];
    netObligations: ReturnType<typeof runNetting>['netObligations'];
    unmatchedIntents: ReturnType<typeof runNetting>['unmatchedIntents'];
    settlementPlan: ReturnType<typeof buildSettlementPlan>;
    totalMatchedUsd: number;
    totalSavingsUsd: number;
    rateSourceNote: string;
    rateDate: string | null;
    /** Size of the open pool this run matched against. */
    poolSize: number;
    /** Present when the Guardian's standing liquidity seeded corridors this
     *  run — names how many were seeded and how many skipped (no live rate). */
    bootstrapNote?: string | null;
    /** True when the run was a walletless observer (dry-run) — matches are
     *  real engine output but nothing was persisted. */
    observer?: boolean;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<MatchResponse | { error: string }>,
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { allowed, retryAfterSec } = rateLimit(`fxnet:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: 'Too many requests — try again shortly.' });
    }

    try {
        const body = req.body as { intents?: FxIntent[] };
        const allBodyIntents = Array.isArray(body?.intents) ? body.intents : [];

        // Walletless visitors join the run as OBSERVERS: their intents drive
        // this match run (a judge with no wallet sees the real engine match
        // against the real pool) but are never persisted — no ghost intents
        // that can never settle, no pool consumption by preview runs.
        const observerIntents = allBodyIntents.filter((i) =>
            isObserverIntent(String(i.participantId ?? '')),
        );
        const bodyIntents = allBodyIntents.filter(
            (i) => !isObserverIntent(String(i.participantId ?? '')),
        );

        await connectDB();

        // Fetch live mid-market rates FIRST — rate coverage is a validation
        // input. A code outside the table would otherwise price at a silent
        // 1:1 inside the adapter and fabricate a rate.
        const rateProvider = await buildLiveRateProvider();

        // Validate EVERYTHING before persisting anything — a malformed body
        // must never leave a half-upserted pool behind.
        const isoShape = /^[A-Z]{3}$/;
        const validateIntent = (intent: FxIntent): string | null => {
            if (!intent.participantId || !intent.sellCurrency || !intent.buyCurrency || !intent.sellAmount) {
                return 'Each intent needs participantId, sellCurrency, buyCurrency, sellAmount';
            }
            if (intent.sellCurrency === intent.buyCurrency) {
                return 'sellCurrency and buyCurrency must differ';
            }
            if (!isoShape.test(intent.sellCurrency) || !isoShape.test(intent.buyCurrency)) {
                return 'Currency codes must be 3-letter ISO 4217 (e.g. JMD, BBD)';
            }
            if (!rateProvider.hasRate(intent.sellCurrency) || !rateProvider.hasRate(intent.buyCurrency)) {
                return `Unsupported currency — no live rate for ${intent.sellCurrency}/${intent.buyCurrency}`;
            }
            return null;
        };
        for (const intent of bodyIntents) {
            const error = validateIntent(intent);
            if (error) return res.status(400).json({ error });
        }
        for (const intent of observerIntents) {
            const error = validateIntent(intent);
            if (error) return res.status(400).json({ error });
        }
        if (observerIntents.length > 0 && bodyIntents.length > 0) {
            return res.status(400).json({
                error: 'Mixing observer (walletless) and persisted intents in one run is not supported',
            });
        }

        // Hosted pool: any intents supplied in the body (e.g. the card's
        // just-submitted intent) are upserted first, then the FULL open pool
        // is loaded — so a match run fills both the caller's intent and any
        // counterparty intents posted earlier. Idempotent per participant+pair
        // (see upsertPoolIntent), so card retries don't pile up duplicates.
        for (const intent of bodyIntents) {
            await upsertPoolIntent(FxIntentRecord, intent);
        }

        const now = Date.now();

        // Liquidity bootstrap (honest cold start): the Guardian seeds the
        // deepest Caribbean corridors with STANDING mid-market intents so a
        // real SME's first intent finds a counterparty instead of a dead
        // pool. Guardian ids are `guardian-liquidity-` prefixed, excluded
        // from credit scoring, and settlement of a Guardian-matched leg
        // remains zero-custody (the Guardian intent is a standing quote, NOT
        // a promise of settlement capital — funded-float participation is an
        // explicit Phase 2 workstream). Skipped corridors are disclosed,
        // never seeded at a fabricated rate.
        //
        // A walletless OBSERVER run never seeds: a preview must not mutate
        // the pool it previews (the same dry-run guarantee as below).
        let bootstrapNote: string | null = null;
        if (observerIntents.length === 0) {
            const standing = buildStandingIntents(now, (c) => {
                if (!rateProvider.hasRate(c)) return null;
                // local-per-USD for the corridor's sell currency (USD→local).
                // The standing intent sells `amount` units of local for
                // USD-equivalent value at mid-market — the engine prices
                // the match itself.
                return rateProvider.midRate('USD', c);
            });
            if (standing.intents.length > 0) {
                for (const intent of standing.intents) {
                    await upsertPoolIntent(FxIntentRecord, intent);
                }
                bootstrapNote = standing.skipped.length > 0
                    ? `Guardian standing liquidity seeded ${standing.intents.length} corridor(s); ${standing.skipped.length} skipped (no live rate).`
                    : `Guardian standing liquidity seeded ${standing.intents.length} corridor(s) at mid-market.`;
            }
        }

        const pool = await loadOpenPool(FxIntentRecord, now);

        // Observer intents join THIS run's matching set but never the pool.
        // Persisted pool intents (if any body intents exist) were upserted
        // above; the observer's intent is appended in-memory only so the
        // engine matches it against real pool counterparties.
        const runPool = [...pool, ...observerIntents];

        // Run the matching + netting pipeline against the hosted pool
        const result = runNetting(
            runPool,
            rateProvider.midRate,
            'cUSD',
            now,
        );

        if (observerIntents.length > 0) {
            // Dry-run: report outcomes for the observer's leg but persist
            // nothing. Two things must NOT happen: pool intents being
            // consumed by a preview (their remainingSell would drain with no
            // one able to settle), and ghost settlement records appearing in
            // a walletless visitor's inbox.
            const observerIds = new Set(observerIntents.map((i) => String(i.participantId)));
            const observerMatches = result.matches.filter(
                (m) =>
                    observerIds.has(String(m.intentA.participantId)) ||
                    observerIds.has(String(m.intentB.participantId)),
            );
            const observerNet = result.netObligations;
            const observerSettlementPlan = buildSettlementPlan({
                ...result,
                matches: observerMatches,
            });
            return res.status(200).json({
                ok: true,
                matches: observerMatches,
                netObligations: observerNet,
                unmatchedIntents: result.unmatchedIntents.filter(
                    (u) => observerIds.has(String(u.participantId)),
                ),
                settlementPlan: observerSettlementPlan,
                // Observer savings numbers are real math (same engine, same
                // rates) but scoped to the observer's matches only.
                totalMatchedUsd: observerMatches.reduce(
                    (sum, m) => sum + m.notionalUsd,
                    0,
                ),
                totalSavingsUsd: observerMatches.reduce(
                    (sum, m) => sum + (m.savingsBps / 10_000) * m.notionalUsd,
                    0,
                ),
                rateSourceNote: rateProvider.sourceNote,
                rateDate: rateProvider.date,
                poolSize: pool.length,
                observer: true,
            });
        }

        // Persist match outcomes: remainingSell decrements, status advances
        // (matched / partially_matched), matchId audit trail per intent.
        await persistMatchOutcomes(FxIntentRecord, result.matches);

        // Build the settlement plan (ledger anchors + transfers + residuals)
        const settlementPlan = buildSettlementPlan(result);

        // Persist durable settlement records for the net obligations so the
        // debtor can execute the transfer later (POST /api/fx-netting/settle
        // verifies it on-chain and advances both sides to `settled`). The
        // intent ids each obligation collapses are the matched intents of
        // its source matches (deduped). Chain + currency are per-obligation —
        // the engine's region-canonical routing (APAC → HashKey/USDT,
        // Africa/Caribbean/LatAm → Celo/cUSD) — never a global constant.
        const obligations = settlementPlan.transfers.map((t) => ({
            fromParticipant: t.fromParticipant,
            toParticipant: t.toParticipant,
            settlementCurrency: t.settlementCurrency,
            netAmount: t.netAmount,
            chainId: t.chainId,
            sourceMatchIds: t.sourceMatchIds,
        }));
        if (obligations.length > 0) {
            const matchIntentIndex = new Map<string, string[]>();
            for (const t of settlementPlan.transfers) {
                const ids = new Set<string>();
                for (const matchId of t.sourceMatchIds) {
                    const m = result.matches.find((x) => x.matchId === matchId);
                    if (!m) continue;
                    ids.add(m.intentA.intentId);
                    ids.add(m.intentB.intentId);
                }
                matchIntentIndex.set(
                    `${t.fromParticipant}>${t.toParticipant}`,
                    [...ids],
                );
            }
            const { buildSettlementRecords } = await import(
                '@diversifi/shared/src/services/fx-netting/settlement-execution'
            );
            const { persistSettlements } = await import('@/lib/fx-intent-pool');
            const { FxSettlementRecord } = await import('@/models/FxSettlementRecord');
            const records = buildSettlementRecords(obligations, {
                now,
            }).map((r) => ({
                ...r,
                intentIds: matchIntentIndex.get(
                    `${r.fromParticipant}>${r.toParticipant}`,
                ) ?? [],
            }));
            await persistSettlements(FxSettlementRecord, records);
        }

        // Anchor each match to the RecommendationLedger (fire-and-forget).
        // Same pattern as the x402-gateway FX Protection Insight anchor
        // (pages/api/agent/x402-gateway.ts:650-678) — best-effort, never blocks.
        if (settlementPlan.matchAnchors.length > 0) {
            void import('@diversifi/shared/src/services/recommendation-ledger.service').then(
                ({ recommendationLedgerService }) => {
                    for (const anchor of settlementPlan.matchAnchors) {
                        recommendationLedgerService
                            .recordRecommendation({
                                user: anchor.user,
                                action: anchor.action,
                                targetToken: anchor.targetToken,
                                reasoning: anchor.reasoning,
                                evidenceCid: anchor.evidenceCid,
                                servingModel: anchor.servingModel,
                                confidence: anchor.confidence,
                                ...(anchor.chainId ? { chainId: anchor.chainId } : {}),
                            })
                            .catch((err: unknown) =>
                                console.warn(
                                    '[FX-Netting] Ledger anchor skipped:',
                                    err instanceof Error ? err.message : err,
                                ),
                            );
                    }
                },
            ).catch(() => {
                // Ledger service unavailable — non-fatal, the match result is still valid.
            });
        }

        return res.status(200).json({
            ok: true,
            matches: result.matches,
            netObligations: result.netObligations,
            unmatchedIntents: result.unmatchedIntents,
            settlementPlan,
            totalMatchedUsd: result.totalMatchedUsd,
            totalSavingsUsd: result.totalSavingsUsd,
            rateSourceNote: rateProvider.sourceNote,
            rateDate: rateProvider.date,
            poolSize: pool.length,
            bootstrapNote,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'FX netting failed';
        return res.status(400).json({ error: message });
    }
}
