/**
 * Acceptance logic for the Jev router spike: the confidence bar and margin
 * over the runner-up are the gate on any future promotion out of shadow
 * mode, so they get pinned directly with a stubbed direct-REST provider.
 */

import { describe, it, expect, vi } from 'vitest';
import {
    classifySkeletonWithJev,
    isAcceptedIntent,
} from '../classify-with-jev';

function directResponse(body: unknown) {
    return {
        ok: true,
        status: 200,
        json: async () => body,
    } as Response;
}

async function classifyWith(intent: Record<string, unknown>) {
    const fetchImpl = vi.fn().mockResolvedValue(directResponse({
        model: 'jev-latest',
        answers: { intent },
    }));
    const assessment = await classifySkeletonWithJev(
        'inflation_rank?threshold=5&dir=higher',
        { apiKey: 'test-key', aiGatewayApiKey: '', fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    return { fetchImpl, assessment };
}

describe('classifySkeletonWithJev (direct provider)', () => {
    it('returns null when no provider key is configured', async () => {
        const previous = process.env;
        process.env = { ...previous, AI_GATEWAY_API_KEY: '', TYPESAFE_API_KEY: '', TYPESAFE_AI_API_KEY: '' };
        try {
            expect(await classifySkeletonWithJev('inflation_rank?threshold=5&dir=higher')).toBeNull();
        } finally {
            process.env = previous;
        }
    });

    it('carries choice, confidence, and margin over the runner-up', async () => {
        const { assessment } = await classifyWith({
            type: 'choice',
            choice: 'inflation_rank',
            confidence: 0.9,
            probabilities: { inflation_rank: 0.9, other: 0.05, depreciation_rank: 0.05 },
        });
        expect(assessment).not.toBeNull();
        expect(assessment?.provider).toBe('typesafe-direct');
        expect(assessment?.intent).toBe('inflation_rank');
        expect(assessment?.confidence).toBe(0.9);
        expect(assessment?.margin).toBeCloseTo(0.85);
        expect(isAcceptedIntent(assessment)).toBe(true);
    });

    it('rejects when the margin over the runner-up is below the bar', async () => {
        const { assessment } = await classifyWith({
            type: 'choice',
            choice: 'inflation_rank',
            confidence: 0.85,
            probabilities: { inflation_rank: 0.85, inflation_single: 0.6 },
        });
        expect(assessment?.margin).toBeCloseTo(0.25);
        expect(isAcceptedIntent(assessment)).toBe(false);
    });

    it('never accepts "other"', async () => {
        const { assessment } = await classifyWith({
            type: 'choice',
            choice: 'other',
            confidence: 0.99,
            probabilities: { other: 0.99 },
        });
        expect(assessment?.intent).toBe('other');
        expect(isAcceptedIntent(assessment)).toBe(false);
    });

    it('falls through on malformed vendor output', async () => {
        const { assessment } = await classifyWith({ type: 'choice', choice: 'not_a_kind', confidence: 0.9 });
        expect(assessment).toBeNull();
    });
});
