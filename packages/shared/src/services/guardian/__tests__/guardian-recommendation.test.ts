import { beforeEach, describe, expect, it, vi } from 'vitest';
const chat = vi.hoisted(() => vi.fn());
vi.mock('../../ai/ai-service', () => ({ AIService: { chat } }));
import { GuardianRecommendationService as Service } from '../guardian-recommendation.service';
import type { GuardianAnalysisContext } from '../guardian-analysis-data.service';

const context = {
  portfolioData: { balance: 100, holdings: ['USDC'] },
  unifiedBalance: { totalUSDC: '100' },
  inflationResult: { data: {} }, economicResult: { data: {} }, yieldResult: { data: {} },
  pulse: { source: 'fallback' },
} as GuardianAnalysisContext;

beforeEach(() => { chat.mockReset(); });

describe('code-owned research decision', () => {
  it('accepts bounded commentary, not authority fields', () => {
    expect(Service.parseCommentary('{"commentary":"Research summary."}')).toEqual({ commentary: 'Research summary.' });
    for (const input of [
      '{"commentary":"Move now","action":"SWAP"}', '[{"commentary":"x"}]',
      '{"commentary":1}', '{"commentary":""}', 'not json',
      JSON.stringify({ commentary: 'x'.repeat(1201) }),
    ]) expect(Service.parseCommentary(input)).toEqual({});
  });

  it('asks for commentary only and rejects an old model recommendation', async () => {
    chat.mockResolvedValue({ data: '{"action":"SWAP","confidence":1,"expectedSavings":99999}' });
    expect(await Service.generateRecommendation(context)).toEqual({});
    expect(chat.mock.calls[0][0].messages[0].content).toContain('code-owned decision is HOLD');
  });

  it('model outages do not change the deterministic floor', async () => {
    chat.mockRejectedValue(new Error('unavailable'));
    expect(await Service.generateRecommendation(context)).toEqual({});
  });

  it('a forged model decision cannot select a trade or publish estimates', () => {
    const result = Service.buildFinalResult({
      recommendation: {
        commentary: 'Swap now', action: 'SWAP', targetToken: 'PAXG',
        confidence: 1, riskLevel: 'LOW', expectedSavings: 99999,
        executionMode: 'MAINNET_READY', arcTxHash: '0xfake',
      } as never,
      dataSources: ['source'], paymentHashes: { source: 'research-proof' },
      evidenceCids: { source: 'cid' }, steps: ['Research fetched'],
    });
    expect(result).toMatchObject({ action: 'HOLD', confidence: 0, riskLevel: 'UNKNOWN', executionMode: 'ADVISORY', urgencyLevel: 'LOW' });
    expect(result).not.toHaveProperty('expectedSavings');
    expect(result.targetToken).toBeUndefined();
    expect(result.arcTxHash).toBeUndefined();
    expect(result.researchCommentary).toBeUndefined();
    expect(result.paymentHashes).toEqual({ source: 'research-proof' });
    expect(result.evidenceCids).toEqual({ source: 'cid' });
  });

  it('separates model commentary from the deterministic reasoning', () => {
    const result = Service.buildFinalResult({
      recommendation: { commentary: 'Public research summary.' },
      dataSources: [], paymentHashes: {}, steps: [],
    });
    expect(result.researchCommentary).toBe('Public research summary.');
    expect(result.reasoning).toContain('No portfolio move is justified');
    expect(result.reasoning).not.toContain('Public research summary.');
  });
});
