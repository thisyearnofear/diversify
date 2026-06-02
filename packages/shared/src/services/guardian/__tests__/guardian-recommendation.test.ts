import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock AIService BEFORE importing the service that uses it.
// We don't want real network calls or provider init in unit tests.
const mockChat = vi.fn();
vi.mock('../../../services/ai/ai-service', () => ({
  AIService: {
    chat: (...args: unknown[]) => mockChat(...args),
    getStatus: vi.fn(),
  },
}));

import { GuardianRecommendationService } from '../guardian-recommendation.service';
import { AgentService } from '../../agent-service';

/**
 * Post-sunset regression tests for the Guardian recommendation code path.
 *
 * The Synth sunset (commit 2a30322) removed the SYNTHDATA prompt section
 * and the `synthPredictions` context field. These tests pin the post-sunset
 * prompt shape and exercise the parser/builder through a mocked AIService
 * to confirm the path still produces a valid AnalysisResult without any
 * Synth-derived fields.
 *
 * Live end-to-end coverage of the same path is in
 * scripts/test-guardian-loop.sh, which hits the running /api/agent/guardian-loop
 * with the cron secret.
 */

const buildMockContext = () => ({
  portfolioData: { balance: 100, holdings: ['cUSD'] },
  unifiedBalance: { totalUSDC: '100', arcBalance: '100', chainBalances: [] },
  macroData: {},
  researchBundle: undefined,
  inflationResult: { data: { countries: [] }, hashes: {} },
  economicResult: { data: {}, hashes: {} },
  yieldResult: { data: {}, hashes: {} },
  pulse: {
    sentiment: 0.5,
    btcPrice: 68000,
    btcChange24h: 1.5,
    goldPrice: 2400,
    goldChange24h: 0.2,
    warRisk: 0.1,
    aiMomentum: 0.4,
    defenseSpending: 0.5,
    liquidationRisk: 12,
    horizon: '24h' as const,
    lastUpdated: Date.now(),
    source: 'api' as const,
  },
  riskStatus: { status: 'NOMINAL' },
});

describe('GuardianRecommendationService (post-sunset)', () => {
  describe('buildPrompt', () => {
    it('does not include any Synth references', () => {
      const prompt = GuardianRecommendationService.buildPrompt(buildMockContext());

      expect(prompt).not.toMatch(/synth/i);
      expect(prompt).not.toContain('SYNTHDATA');
      expect(prompt).not.toContain('synthPredictions');
      expect(prompt).not.toContain('SynthDataService');
    });

    it('includes the post-sunset data sections', () => {
      const prompt = GuardianRecommendationService.buildPrompt(buildMockContext());

      expect(prompt).toContain('PORTFOLIO');
      expect(prompt).toContain('MARKET PULSE');
      expect(prompt).toContain('TRUFLATION / MACRO');
      expect(prompt).toContain('YIELD OPPORTUNITIES');
    });

    it('embeds the live pulse fields from the context', () => {
      const ctx = buildMockContext();
      ctx.pulse = { ...ctx.pulse, sentiment: 0.85, liquidationRisk: 42 };
      const prompt = GuardianRecommendationService.buildPrompt(ctx);

      expect(prompt).toContain('Sentiment: 0.85');
      expect(prompt).toContain('Liquidation Risk: 42%');
    });

    it('asks for the same JSON shape the parser expects', () => {
      const prompt = GuardianRecommendationService.buildPrompt(buildMockContext());

      // Mirror the keys parseRecommendation / buildFinalResult read.
      for (const key of ['action', 'targetToken', 'confidence', 'reasoning', 'riskLevel', 'expectedSavings']) {
        expect(prompt.toLowerCase()).toContain(key.toLowerCase());
      }
    });
  });

  describe('generateRecommendation', () => {
    beforeEach(() => {
      mockChat.mockReset();
    });

    it('parses a Venice-style JSON object into a RecommendationShape', async () => {
      const parsed = { action: 'HOLD', confidence: 0.75, riskLevel: 'LOW', reasoning: 'Macro stable.' };
      mockChat.mockResolvedValue({ data: JSON.stringify(parsed) });

      let capturedPrompt = '';
      mockChat.mockImplementation(async (options: any) => {
        capturedPrompt = options.messages[0].content;
        return { data: JSON.stringify(parsed) };
      });

      const parser = makeParseRecommendation();
      const recommendation = await GuardianRecommendationService.generateRecommendation(
        buildMockContext() as any,
        parser
      );

      // Post-sunset prompt must have been sent
      expect(capturedPrompt).not.toMatch(/synth/i);

      expect(recommendation).toMatchObject({
        action: 'HOLD',
        confidence: 0.75,
        riskLevel: 'LOW',
        reasoning: 'Macro stable.',
      });
    });

    it('parses a top-level JSON array (cleanJsonResponse array support from 36d1dc7)', async () => {
      const arr = { action: 'SWAP', confidence: 0.6, riskLevel: 'MEDIUM', reasoning: 'Bridge to Arbitrum.' };
      mockChat.mockImplementation(async () => ({ data: `[${JSON.stringify(arr)}]` }));

      const parser = makeParseRecommendation();
      const recommendation = await GuardianRecommendationService.generateRecommendation(
        buildMockContext() as any,
        parser
      );

      expect(recommendation).toMatchObject({
        action: 'SWAP',
        confidence: 0.6,
        riskLevel: 'MEDIUM',
      });
    });

    it('falls back to a HOLD when Venice returns prose with no JSON', async () => {
      mockChat.mockResolvedValue({ data: 'I cannot produce structured output at this time.' });

      const parser = makeParseRecommendation();
      const recommendation = await GuardianRecommendationService.generateRecommendation(
        buildMockContext() as any,
        parser
      );

      expect(recommendation).toMatchObject({
        action: 'HOLD',
        confidence: 0.5,
        riskLevel: 'MEDIUM',
      });
    });
  });

  describe('buildFinalResult', () => {
    const baseParams = {
      recommendation: {
        action: 'HOLD' as const,
        confidence: 0.82,
        reasoning: 'Macro balanced; no trigger.',
        riskLevel: 'LOW' as const,
        expectedSavings: 0,
      },
      normalizedAction: 'HOLD' as const,
      normalizeNumber: (value: any, fallback: number, min?: number, max?: number) => {
        const parsed = typeof value === 'number' ? value : parseFloat(value);
        const resolved = Number.isFinite(parsed) ? parsed : fallback;
        const lowerBounded = typeof min === 'number' ? Math.max(min, resolved) : resolved;
        const upperBounded = typeof max === 'number' ? Math.min(max, lowerBounded) : lowerBounded;
        return upperBounded;
      },
      normalizeRiskLevel: (level: any) => {
        const candidate = (level || '').toString().toUpperCase();
        return (candidate === 'LOW' || candidate === 'MEDIUM' || candidate === 'HIGH')
          ? candidate
          : 'MEDIUM';
      },
      determineUrgency: () => 'LOW' as const,
      portfolioValue: 100,
      dataSources: ['coingecko_analytics'],
      paymentHashes: {},
      steps: ['Gathered context'],
    };

    it('produces a valid AnalysisResult with executionMode ADVISORY when no tx', () => {
      const result = GuardianRecommendationService.buildFinalResult(baseParams);

      expect(result.action).toBe('HOLD');
      expect(result.confidence).toBe(0.82);
      expect(result.riskLevel).toBe('LOW');
      expect(result.executionMode).toBe('ADVISORY');
      expect(result.dataSources).toContain('coingecko_analytics');
      expect(result.actionSteps).toContain('Gathered context');
    });

    it('promotes executionMode to MAINNET_READY when an execution tx hash is present', () => {
      const result = GuardianRecommendationService.buildFinalResult({
        ...baseParams,
        executionTxHash: '0xabc123',
      });

      expect(result.executionMode).toBe('MAINNET_READY');
      expect(result.arcTxHash).toBe('0xabc123');
    });

    it('clamps confidence to [0, 1] and uses the prompt fallback for missing reasoning', () => {
      const result = GuardianRecommendationService.buildFinalResult({
        ...baseParams,
        recommendation: {
          action: 'SWAP',
          confidence: 5, // out of range — should clamp to 1
          // reasoning omitted — should fall back
        },
      });

      expect(result.confidence).toBe(1);
      expect(result.reasoning).toMatch(/balanced hold/i);
    });
  });
});

/**
 * Build a parseRecommendation function bound to AgentService's prototype
 * without running its heavy constructor (which sets up wallet providers,
 * VaultService, etc.). parseRecommendation is a pure function of its
 * argument; it does not touch `this` state.
 */
function makeParseRecommendation() {
  const agent = Object.create(AgentService.prototype) as any;
  return (content: string) => agent.parseRecommendation(content);
}
