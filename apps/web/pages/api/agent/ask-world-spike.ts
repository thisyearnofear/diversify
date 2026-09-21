/**
 * Ask-the-World router — TypeSafe/Jev classification of privacy-minimised
 * question skeletons.
 *
 * Accepts ONLY a canonical question skeleton (regex re-validated here so
 * this route can never be pointed at the vendor with arbitrary text), runs
 * the confidence-gated Jev classification, logs divergence against the
 * deterministic classifier, and returns the verdict. The client may route
 * an *accepted* miss into the deterministic facts path — Jev never supplies
 * numbers. Telemetry is TTL'd at 30 days and stores only a skeleton hash.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';
import connectDB from '@/lib/mongodb';
import { AI_FEATURES } from '@diversifi/shared/src/config/features';
import {
    classifySkeletonWithJev,
    isAcceptedIntent,
} from '@/lib/agent/ask-world-spike/classify-with-jev';
import { classifySpikeAgreement } from '@/lib/agent/ask-world-spike/agreement';
import { AskWorldSpikeLog } from '@/models/AskWorldSpikeLog';

/** Exactly the shapes minimize-question.ts can emit — nothing else ships. */
const SKELETON_SHAPE = new RegExp([
    '^inflation_single\\?country=[a-z]{1,20}$',
    '^inflation_rank\\?threshold=\\d{1,3}(?:\\.\\d)?&dir=(?:higher|lower)$',
    '^depreciation_single\\?currency=[a-z]{1,20}&horizon=[135]$',
    '^depreciation_rank\\?horizon=[135]$',
].join('|'));

const REGEX_KINDS = new Set(['none', 'inflation_rank', 'inflation_single', 'depreciation_rank', 'depreciation_single']);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!AI_FEATURES.TYPESAFE_ASK_WORLD_SPIKE) {
        return res.status(200).json({ fallthrough: true, disabled: true });
    }

    const { skeleton, regexKind } = (req.body ?? {}) as { skeleton?: unknown; regexKind?: unknown };
    if (typeof skeleton !== 'string' || !SKELETON_SHAPE.test(skeleton)) {
        return res.status(400).json({ error: 'A canonical question skeleton is required' });
    }
    const regexBucket = typeof regexKind === 'string' && REGEX_KINDS.has(regexKind) ? regexKind : 'none';

    const assessment = await classifySkeletonWithJev(skeleton);
    if (!assessment) {
        return res.status(200).json({ fallthrough: true, reason: 'provider_unavailable' });
    }

    const accepted = isAcceptedIntent(assessment);
    const bucket = classifySpikeAgreement(
        regexBucket === 'none' ? null : regexBucket,
        { intent: assessment.intent, accepted },
    );

    try {
        await connectDB();
        await AskWorldSpikeLog.create({
            skeletonHash: createHash('sha256').update(skeleton).digest('hex'),
            regexKind: regexBucket,
            bucket: bucket ?? 'uncomparable',
            jev: {
                provider: assessment.provider,
                model: assessment.model,
                intent: assessment.intent,
                confidence: assessment.confidence,
                margin: assessment.margin,
                accepted,
                durationMs: assessment.durationMs,
            },
            // Shadow comparison data expires after 30 days — retained
            // history this is not.
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
    } catch (error: unknown) {
        // Telemetry failure must not alter the (already advisory-only) answer.
        console.warn('[ask-world-spike] Could not record spike telemetry:', error instanceof Error ? error.message : error);
    }

    return res.status(200).json({
        intent: assessment.intent,
        confidence: assessment.confidence,
        margin: assessment.margin,
        accepted,
        bucket,
    });
}
