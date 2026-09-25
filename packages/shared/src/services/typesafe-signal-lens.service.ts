import { fetchWithTimeout } from '../utils/promise-utils';

const TYPESAFE_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_TIMEOUT_MS = 6_000;

export type TypeSafeSignalCategory =
  | 'rate_hike'
  | 'rate_cut'
  | 'yield_change'
  | 'depeg_risk'
  | 'inflation_shift'
  | 'regulatory'
  | 'none';

export type TypeSafeSignalUrgency = 'monitor' | 'review' | 'time_sensitive';

export interface StructuredSignalAssessment {
  /** Gateway is preferred while promotional access is available; direct is the durable fallback. */
  provider: 'vercel-ai-gateway' | 'typesafe-direct';
  model: string;
  evaluatedAt: string;
  materiality: number;
  category: TypeSafeSignalCategory;
  categoryConfidence: number;
  urgency: TypeSafeSignalUrgency;
  urgencyConfidence: number;
  sourceQuality: number;
  sourceQualityConfidence: number;
  /** Wall-clock ms measured server-side for this assessment call only. */
  durationMs?: number;
}

type ChoiceAnswer = {
  type: 'choice';
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

type ScoreAnswer = {
  type: 'score';
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
};

type NoulAnswer = {
  type: 'noul';
  noul: number;
};

type TypeSafeResponse = {
  model: string;
  answers: {
    materiality?: NoulAnswer;
    category?: ChoiceAnswer;
    urgency?: ChoiceAnswer;
    source_quality?: ScoreAnswer;
  };
};

type GatewayAnswers = {
  materiality?: { type: 'boolean'; probability: number };
  category?: { type: 'choice'; choice: string; probabilities?: Record<string, number> };
  urgency?: { type: 'choice'; choice: string; probabilities?: Record<string, number> };
  source_quality?: { type: 'score'; score: number; probabilities?: Record<string, number> };
};

type GatewayResult = {
  modelId?: string;
  model?: string;
  answers: GatewayAnswers;
  providerMetadata?: {
    typesafe?: { confidence?: Record<string, number> };
  };
};

type GatewayEvaluate = (request: {
  model: string;
  state: Record<string, string>;
  questions: Record<string, unknown>;
  abortSignal: AbortSignal;
}) => Promise<GatewayResult>;

/**
 * `ai` is ESM-only while this shared package intentionally compiles to
 * CommonJS — it can never literally `import('ai')` here. Server-only callers
 * (apps/web) inject the evaluator via `options.evaluateGateway`
 * (`lib/agent/load-gateway-evaluate.ts`); without it the Gateway branch is
 * skipped and the direct TypeSafe REST fallback below applies.
 */

function isChoice(value: unknown, choices: readonly string[]): value is ChoiceAnswer {
  return !!value
    && typeof value === 'object'
    && (value as ChoiceAnswer).type === 'choice'
    && choices.includes((value as ChoiceAnswer).choice)
    && Number.isFinite((value as ChoiceAnswer).confidence);
}

function isScore(value: unknown): value is ScoreAnswer {
  return !!value
    && typeof value === 'object'
    && (value as ScoreAnswer).type === 'score'
    && Number.isFinite((value as ScoreAnswer).score)
    && Number.isFinite((value as ScoreAnswer).confidence);
}

function isNoul(value: unknown): value is NoulAnswer {
  return !!value
    && typeof value === 'object'
    && (value as NoulAnswer).type === 'noul'
    && Number.isFinite((value as NoulAnswer).noul);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function questions() {
  return {
    materiality: {
      type: 'boolean',
      instructions: 'Does this public source change contain a specific, material macro or market development rather than commentary, navigation, or routine page noise?',
    },
    category: {
      type: 'choice',
      instructions: 'Classify the primary market signal in the public source change. Choose none if there is no specific market-moving signal.',
      criteria: {
        rate_hike: 'A central bank or policy-rate increase.',
        rate_cut: 'A central bank or policy-rate reduction.',
        yield_change: 'A material change in yield, liquidity, or market return conditions.',
        depeg_risk: 'A stablecoin losing or credibly at risk of losing its peg.',
        inflation_shift: 'A material inflation or purchasing-power change.',
        regulatory: 'A material regulation, restriction, or approval affecting financial markets.',
        none: 'No specific market-moving signal.',
      },
    },
    urgency: {
      type: 'choice',
      instructions: 'Classify how quickly a human should review this public signal. This is advisory triage only, never an instruction to trade.',
      criteria: {
        monitor: 'Worth monitoring but not currently time-sensitive.',
        review: 'A user-facing review is appropriate soon.',
        time_sensitive: 'A clearly time-sensitive development that merits prompt human review.',
      },
    },
    source_quality: {
      type: 'score',
      instructions: 'Score whether the source change is specific, current, and sufficiently evidenced for a user-facing macro alert.',
      criteria: [
        'Insufficient, vague, stale, or unsupported.',
        'Partially specific but missing important context.',
        'Specific, current, and supported by the source excerpt.',
      ],
    },
  };
}

function normalizeGatewayResult(result: GatewayResult): StructuredSignalAssessment | null {
  const categories = ['rate_hike', 'rate_cut', 'yield_change', 'depeg_risk', 'inflation_shift', 'regulatory', 'none'] as const;
  const urgencies = ['monitor', 'review', 'time_sensitive'] as const;
  const materiality = result.answers.materiality;
  const category = result.answers.category;
  const urgency = result.answers.urgency;
  const sourceQuality = result.answers.source_quality;
  const confidence = result.providerMetadata?.typesafe?.confidence ?? {};

  if (
    materiality?.type !== 'boolean' || !Number.isFinite(materiality.probability)
    || category?.type !== 'choice' || !categories.includes(category.choice as TypeSafeSignalCategory)
    || urgency?.type !== 'choice' || !urgencies.includes(urgency.choice as TypeSafeSignalUrgency)
    || sourceQuality?.type !== 'score' || !Number.isFinite(sourceQuality.score)
  ) {
    return null;
  }

  return {
    provider: 'vercel-ai-gateway',
    model: result.modelId || result.model || 'typesafe-ai/jev',
    evaluatedAt: new Date().toISOString(),
    materiality: clamp(materiality.probability, 0, 1),
    category: category.choice as TypeSafeSignalCategory,
    categoryConfidence: clamp(confidence.category ?? 0, 0, 1),
    urgency: urgency.choice as TypeSafeSignalUrgency,
    urgencyConfidence: clamp(confidence.urgency ?? 0, 0, 1),
    sourceQuality: clamp(sourceQuality.score, 0, 2),
    sourceQualityConfidence: clamp(confidence.source_quality ?? 0, 0, 1),
  };
}

/**
 * Optional structured review for public macro-source changes.
 *
 * Gateway is preferred when `AI_GATEWAY_API_KEY` is configured. Direct
 * TypeSafe REST remains supported as the deliberate fallback for periods when
 * Gateway access is unavailable. This is advisory-only: callers must not use
 * it to bypass deterministic Guardian policy or alter execution.
 */
export async function assessMacroSignalWithTypeSafe(
  input: { sourceUrl?: string; sourceSummary?: string; changeContent: string },
  options: {
    apiKey?: string;
    aiGatewayApiKey?: string;
    enabled?: boolean;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
    evaluateGateway?: GatewayEvaluate;
  } = {},
): Promise<StructuredSignalAssessment | null> {
  const directApiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY ?? process.env.TYPESAFE_AI_API_KEY;
  const gatewayApiKey = options.aiGatewayApiKey ?? process.env.AI_GATEWAY_API_KEY;
  const enabled = options.enabled ?? process.env.ENABLE_TYPESAFE_SIGNAL_LENS === 'true';
  if (!enabled || (!gatewayApiKey && !directApiKey)) return null;

  const state = {
    sourceUrl: input.sourceUrl || 'unknown',
    sourceSummary: input.sourceSummary || '',
    // Bound vendor input to a public source excerpt; callers must not add user data.
    changeContent: input.changeContent.slice(0, 2_000),
  };
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (gatewayApiKey && !options.evaluateGateway) {
    console.warn('[TypeSafe Signal Lens] AI_GATEWAY_API_KEY set but evaluateGateway not injected — using direct fallback');
  }

  if (gatewayApiKey && options.evaluateGateway) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // The SDK reads AI_GATEWAY_API_KEY from the server environment. This
      // branch is intentionally Gateway-first for spend controls, logs, and
      // promotional access; direct TypeSafe remains available below.
      const evaluate = options.evaluateGateway;
      const startedAt = Date.now();
      const assessment = normalizeGatewayResult(await evaluate({
        model: 'typesafe-ai/jev',
        state,
        questions: questions(),
        abortSignal: controller.signal,
      }));
      if (assessment) return { ...assessment, durationMs: Date.now() - startedAt };
      console.warn('[TypeSafe Signal Lens] Gateway returned an invalid structured response');
    } catch (error: unknown) {
      console.warn('[TypeSafe Signal Lens] Gateway evaluation unavailable:', error instanceof Error ? error.message : error);
    } finally {
      clearTimeout(timer);
    }
  }

  if (!directApiKey) return null;

  try {
    const startedAt = Date.now();
    const q = questions();
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
          questions: {
            materiality: { type: 'noul', instructions: q.materiality.instructions },
            category: { ...q.category, type: 'choice' },
            urgency: { ...q.urgency, type: 'choice' },
            source_quality: { ...q.source_quality, type: 'score' },
          },
        }),
      },
      timeoutMs,
      options.fetchImpl,
    );

    if (!response.ok) {
      console.warn(`[TypeSafe Signal Lens] Direct evaluation unavailable: HTTP ${response.status}`);
      return null;
    }

    const body = await response.json() as TypeSafeResponse;
    const materiality = body.answers?.materiality;
    const category = body.answers?.category;
    const urgency = body.answers?.urgency;
    const sourceQuality = body.answers?.source_quality;
    const categories = ['rate_hike', 'rate_cut', 'yield_change', 'depeg_risk', 'inflation_shift', 'regulatory', 'none'] as const;
    const urgencies = ['monitor', 'review', 'time_sensitive'] as const;
    if (!isNoul(materiality) || !isChoice(category, categories) || !isChoice(urgency, urgencies) || !isScore(sourceQuality)) {
      console.warn('[TypeSafe Signal Lens] Direct evaluation returned an invalid structured response');
      return null;
    }

    return {
      provider: 'typesafe-direct',
      model: body.model,
      evaluatedAt: new Date().toISOString(),
      materiality: clamp(materiality.noul, 0, 1),
      category: category.choice as TypeSafeSignalCategory,
      categoryConfidence: clamp(category.confidence, 0, 1),
      urgency: urgency.choice as TypeSafeSignalUrgency,
      urgencyConfidence: clamp(urgency.confidence, 0, 1),
      sourceQuality: clamp(sourceQuality.score, 0, 2),
      sourceQualityConfidence: clamp(sourceQuality.confidence, 0, 1),
      durationMs: Date.now() - startedAt,
    };
  } catch (error: unknown) {
    console.warn('[TypeSafe Signal Lens] Direct evaluation unavailable:', error instanceof Error ? error.message : error);
    return null;
  }
}
