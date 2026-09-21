/**
 * Jev (TypeSafe) skeleton-intent classification — SERVER SIDE ONLY.
 *
 * Reuses the Signal Lens two-provider strategy: Vercel AI Gateway first
 * (spend controls + promo access), direct TypeSafe REST as the durable
 * fallback. Input is a canonical question skeleton produced by
 * minimize-question.ts — never user prose.
 *
 * Acceptance bar (deliberately strict, this gates any future promotion out
 * of shadow mode): top choice must be one of the four Ask-the-World kinds
 * with confidence >= 0.8 AND a margin >= 0.3 over the runner-up. Anything
 * else — including 'other' — falls through to the advisor.
 */

import { fetchWithTimeout } from '@diversifi/shared/src/utils/promise-utils';
import type { AskWorldKind } from '../ask-world-types';

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_TIMEOUT_MS = 6_000;

export const MIN_INTENT_CONFIDENCE = 0.8;
export const MIN_INTENT_MARGIN = 0.3;

const INTENT_CHOICES = [
    'inflation_rank',
    'inflation_single',
    'depreciation_rank',
    'depreciation_single',
    'other',
] as const;

export type JevIntentChoice = (typeof INTENT_CHOICES)[number];

export interface JevIntentAssessment {
    provider: 'vercel-ai-gateway' | 'typesafe-direct';
    model: string;
    intent: JevIntentChoice;
    confidence: number;
    /** confidence minus runner-up probability; equals confidence when the
     *  vendor returned no probability distribution. */
    margin: number;
    /** Wall-clock ms for this call only. */
    durationMs: number;
}

type ChoiceAnswer = {
    type: 'choice';
    choice: string;
    confidence?: number;
    probabilities?: Record<string, number>;
};

type GatewayResult = {
    modelId?: string;
    model?: string;
    answers: { intent?: ChoiceAnswer };
    providerMetadata?: { typesafe?: { confidence?: Record<string, number> } };
};

type GatewayEvaluate = (request: {
    model: string;
    state: Record<string, string>;
    questions: Record<string, unknown>;
    abortSignal: AbortSignal;
}) => Promise<GatewayResult>;

/**
 * Same ESM/CJS constraint as the Signal Lens loader: `ai` is ESM-only and
 * this bundle is CommonJS, so the import goes through `new Function`. Needs
 * an eval-allowed Node runtime; on no-eval hosts the call throws inside the
 * try/catch below and degrades to the direct REST fallback.
 */
async function loadGatewayEvaluate(): Promise<GatewayEvaluate> {
    const loadModule = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<{
        experimental_evaluate?: GatewayEvaluate;
    }>;
    const sdk = await loadModule('ai');
    if (!sdk.experimental_evaluate) {
        throw new Error('AI SDK experimental_evaluate is unavailable');
    }
    return sdk.experimental_evaluate;
}

function intentQuestions() {
    return {
        intent: {
            type: 'choice',
            instructions:
                'A minimised question skeleton is given. Choose which of the four deterministic data-answer classes it asks for. Choose other if it is not clearly one of them.',
            criteria: {
                inflation_rank: 'Which countries are above/below an inflation threshold.',
                inflation_single: 'The inflation rate of one named country.',
                depreciation_rank: 'Which currency lost the most value against USD over a horizon.',
                depreciation_single: 'How much one named currency lost value against USD.',
                other: 'Not clearly one of the four factual classes (advice, portfolio-specific, or ambiguous).',
            },
        },
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function buildAssessment(
    provider: JevIntentAssessment['provider'],
    model: string,
    choice: string,
    confidence: number,
    probabilities: Record<string, number> | undefined,
    durationMs: number,
): JevIntentAssessment | null {
    if (!INTENT_CHOICES.includes(choice as JevIntentChoice)) return null;
    if (!Number.isFinite(confidence)) return null;
    let runnerUp = 0;
    if (probabilities) {
        for (const [key, p] of Object.entries(probabilities)) {
            if (key === choice || !Number.isFinite(p)) continue;
            if (p > runnerUp) runnerUp = p;
        }
    }
    return {
        provider,
        model,
        intent: choice as JevIntentChoice,
        confidence: clamp(confidence, 0, 1),
        margin: clamp(confidence - runnerUp, 0, 1),
        durationMs,
    };
}

export interface ClassifyWithOptions {
    apiKey?: string;
    aiGatewayApiKey?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    evaluateGateway?: GatewayEvaluate;
}

/** Returns null when no provider is reachable/valid — caller treats that as fall-through. */
export async function classifySkeletonWithJev(
    skeleton: string,
    options: ClassifyWithOptions = {},
): Promise<JevIntentAssessment | null> {
    const directApiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY ?? process.env.TYPESAFE_AI_API_KEY;
    const gatewayApiKey = options.aiGatewayApiKey ?? process.env.AI_GATEWAY_API_KEY;
    if (!gatewayApiKey && !directApiKey) return null;

    const state = { questionSkeleton: skeleton.slice(0, 200) };
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if (gatewayApiKey) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const evaluate = options.evaluateGateway ?? await loadGatewayEvaluate();
            const startedAt = Date.now();
            const result = await evaluate({
                model: 'typesafe-ai/jev',
                state,
                questions: intentQuestions(),
                abortSignal: controller.signal,
            });
            const intent = result.answers?.intent;
            if (intent?.type === 'choice') {
                const assessment = buildAssessment(
                    'vercel-ai-gateway',
                    result.modelId || result.model || 'typesafe-ai/jev',
                    intent.choice,
                    result.providerMetadata?.typesafe?.confidence?.intent ?? intent.confidence ?? 0,
                    intent.probabilities,
                    Date.now() - startedAt,
                );
                if (assessment) return assessment;
            }
            console.warn('[AskWorld Spike] Gateway returned an invalid intent response');
        } catch (error: unknown) {
            console.warn('[AskWorld Spike] Gateway evaluation unavailable:', error instanceof Error ? error.message : error);
        } finally {
            clearTimeout(timer);
        }
    }

    if (!directApiKey) return null;

    try {
        const startedAt = Date.now();
        const q = intentQuestions();
        const response = await fetchWithTimeout(
            TYPESAFE_ENDPOINT,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${directApiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    state,
                    model: 'jev-latest',
                    questions: { intent: { ...q.intent, type: 'choice' } },
                }),
            },
            timeoutMs,
            options.fetchImpl,
        );
        if (!response.ok) {
            console.warn(`[AskWorld Spike] Direct evaluation unavailable: HTTP ${response.status}`);
            return null;
        }
        const body = await response.json() as { model?: string; answers?: { intent?: ChoiceAnswer } };
        const intent = body.answers?.intent;
        if (intent?.type === 'choice') {
            const assessment = buildAssessment(
                'typesafe-direct',
                body.model || 'jev-latest',
                intent.choice,
                intent.confidence ?? intent.probabilities?.[intent.choice] ?? 0,
                intent.probabilities,
                Date.now() - startedAt,
            );
            if (assessment) return assessment;
        }
        console.warn('[AskWorld Spike] Direct evaluation returned an invalid intent response');
        return null;
    } catch (error: unknown) {
        console.warn('[AskWorld Spike] Direct evaluation unavailable:', error instanceof Error ? error.message : error);
        return null;
    }
}

/** The promotion bar: accepted only when confident AND clearly ahead of the runner-up. */
export function isAcceptedIntent(assessment: JevIntentAssessment | null): assessment is JevIntentAssessment & { intent: AskWorldKind } {
    if (!assessment) return false;
    if (assessment.intent === 'other') return false;
    return assessment.confidence >= MIN_INTENT_CONFIDENCE && assessment.margin >= MIN_INTENT_MARGIN;
}
