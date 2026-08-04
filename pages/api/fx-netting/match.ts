/**
 * POST /api/fx-netting/match — CARICOM FX matching + net settlement.
 *
 * Accepts a set of open FX intents, runs the matching engine at live
 * mid-market rates, and returns matches + net obligations + savings +
 * the settlement plan. Anchors each match to the RecommendationLedger
 * on the Caribbean region's canonical chain (Celo) — fire-and-forget,
 * same pattern as the x402-gateway FX Protection Insight anchor.
 *
 * This is the flagship endpoint for the Future Caribbean Financial track:
 * "BBD ↔ JMD — Direct" (removing USD as the default bridge).
 *
 * Body: { intents: FxIntent[] }
 * Response: { matches, netObligations, unmatchedIntents, settlementPlan,
 *             totalMatchedUsd, totalSavingsUsd, rateSourceNote, rateDate }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
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
        const intents = body?.intents;
        if (!Array.isArray(intents) || intents.length === 0) {
            return res.status(400).json({ error: 'At least one intent is required' });
        }

        // Validate intent structure
        for (const intent of intents) {
            if (!intent.participantId || !intent.sellCurrency || !intent.buyCurrency || !intent.sellAmount) {
                return res.status(400).json({ error: 'Each intent needs participantId, sellCurrency, buyCurrency, sellAmount' });
            }
            if (intent.sellCurrency === intent.buyCurrency) {
                return res.status(400).json({ error: 'sellCurrency and buyCurrency must differ' });
            }
        }

        // Fetch live mid-market rates
        const rateProvider = await buildLiveRateProvider();

        // Run the matching + netting pipeline
        const result = runNetting(
            intents,
            rateProvider.midRate,
            'cUSD',
            Date.now(),
        );

        // Build the settlement plan (ledger anchors + transfers + residuals)
        const settlementPlan = buildSettlementPlan(result);

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
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'FX netting failed';
        return res.status(400).json({ error: message });
    }
}
