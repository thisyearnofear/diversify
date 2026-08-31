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
import {
    runNetting,
} from '@diversifi/shared/src/services/fx-netting/matching-engine';
import { buildSettlementPlan } from '@diversifi/shared/src/services/fx-netting/settlement';
import { buildLiveRateProvider } from '@diversifi/shared/src/services/fx-netting/rate-adapter';
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
        const bodyIntents = Array.isArray(body?.intents) ? body.intents : [];

        await connectDB();

        // Hosted pool: any intents supplied in the body (e.g. the card's
        // just-submitted intent) are upserted first, then the FULL open pool
        // is loaded — so a match run fills both the caller's intent and any
        // counterparty intents posted earlier. Idempotent per participant+pair
        // (see upsertPoolIntent), so card retries don't pile up duplicates.
        for (const intent of bodyIntents) {
            if (!intent.participantId || !intent.sellCurrency || !intent.buyCurrency || !intent.sellAmount) {
                return res.status(400).json({ error: 'Each intent needs participantId, sellCurrency, buyCurrency, sellAmount' });
            }
            if (intent.sellCurrency === intent.buyCurrency) {
                return res.status(400).json({ error: 'sellCurrency and buyCurrency must differ' });
            }
            await upsertPoolIntent(FxIntentRecord, intent);
        }

        const now = Date.now();
        const pool = await loadOpenPool(FxIntentRecord, now);

        // Fetch live mid-market rates
        const rateProvider = await buildLiveRateProvider();

        // Run the matching + netting pipeline against the hosted pool
        const result = runNetting(
            pool,
            rateProvider.midRate,
            'cUSD',
            now,
        );

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
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'FX netting failed';
        return res.status(400).json({ error: message });
    }
}
