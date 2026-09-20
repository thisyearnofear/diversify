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
  provider: 'typesafe';
  model: string;
  evaluatedAt: string;
  materiality: number;
  category: TypeSafeSignalCategory;
  categoryConfidence: number;
  urgency: TypeSafeSignalUrgency;
  urgencyConfidence: number;
  sourceQuality: number;
  sourceQualityConfidence: number;
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

/**
 * Optional structured review for public macro-source changes.
 *
 * This is deliberately advisory-only. It receives a minimized public source
 * excerpt and metadata, never wallet addresses, balances, permissions, or
 * private chat history. Callers may store it for shadow-mode comparison but
 * must not use it to bypass deterministic Guardian policy or alter execution.
 */
export async function assessMacroSignalWithTypeSafe(
  input: { sourceUrl?: string; sourceSummary?: string; changeContent: string },
  options: {
    apiKey?: string;
    enabled?: boolean;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<StructuredSignalAssessment | null> {
  const apiKey = options.apiKey ?? process.env.TYPESAFE_API_KEY;
  const enabled = options.enabled ?? process.env.ENABLE_TYPESAFE_SIGNAL_LENS === 'true';
  if (!enabled || !apiKey) return null;

  const categories = ['rate_hike', 'rate_cut', 'yield_change', 'depeg_risk', 'inflation_shift', 'regulatory', 'none'] as const;
  const urgencies = ['monitor', 'review', 'time_sensitive'] as const;
  const state = {
    sourceUrl: input.sourceUrl || 'unknown',
    sourceSummary: input.sourceSummary || '',
    // Bound vendor input to a public source excerpt; callers must not add user data.
    changeContent: input.changeContent.slice(0, 2_000),
  };

  try {
    const response = await fetchWithTimeout(
      TYPESAFE_ENDPOINT,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state,
          model: 'jev-latest',
          questions: {
            materiality: {
              type: 'noul',
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
          },
        }),
      },
      options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      options.fetchImpl,
    );

    if (!response.ok) {
      console.warn(`[TypeSafe Signal Lens] Evaluation unavailable: HTTP ${response.status}`);
      return null;
    }

    const body = await response.json() as TypeSafeResponse;
    const materiality = body.answers?.materiality;
    const category = body.answers?.category;
    const urgency = body.answers?.urgency;
    const sourceQuality = body.answers?.source_quality;
    if (!isNoul(materiality) || !isChoice(category, categories) || !isChoice(urgency, urgencies) || !isScore(sourceQuality)) {
      console.warn('[TypeSafe Signal Lens] Evaluation returned an invalid structured response');
      return null;
    }

    return {
      provider: 'typesafe',
      model: body.model,
      evaluatedAt: new Date().toISOString(),
      materiality: Math.max(0, Math.min(1, materiality.noul)),
      category: category.choice as TypeSafeSignalCategory,
      categoryConfidence: Math.max(0, Math.min(1, category.confidence)),
      urgency: urgency.choice as TypeSafeSignalUrgency,
      urgencyConfidence: Math.max(0, Math.min(1, urgency.confidence)),
      sourceQuality: Math.max(0, Math.min(2, sourceQuality.score)),
      sourceQualityConfidence: Math.max(0, Math.min(1, sourceQuality.confidence)),
    };
  } catch (error: unknown) {
    console.warn('[TypeSafe Signal Lens] Evaluation unavailable:', error instanceof Error ? error.message : error);
    return null;
  }
}
