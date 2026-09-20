// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerateChatCompletion = vi.fn();
const mockAssessMacroSignalWithTypeSafe = vi.fn();
const mockRecordRecommendation = vi.fn();
const mockRemember = vi.fn();
const mockDbConnect = vi.fn();
const mockFindOneAndUpdate = vi.fn();

vi.mock('@diversifi/shared', () => ({
  assessMacroSignalWithTypeSafe: (...args: unknown[]) => mockAssessMacroSignalWithTypeSafe(...args),
  generateChatCompletion: (...args: unknown[]) => mockGenerateChatCompletion(...args),
  cogneeMemoryService: { remember: (...args: unknown[]) => mockRemember(...args) },
  recommendationLedgerService: { recordRecommendation: (...args: unknown[]) => mockRecordRecommendation(...args) },
  constantTimeEqual: () => true,
}));

vi.mock('@/lib/vault/guardian-state', () => ({
  enqueueRecommendation: vi.fn(),
}));

vi.mock('@/lib/agent/guardian-event-bus', () => ({
  guardianEventBus: { publish: vi.fn() },
}));

vi.mock('@/models/Permission', () => ({
  Permission: { find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([]) })) },
}));

vi.mock('@/models/Vault', () => ({
  Vault: { findOne: vi.fn() },
}));

vi.mock('@/models/TypeSafeSignalReview', () => ({
  TypeSafeSignalReview: {
    findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args),
  },
}));

vi.mock('@/lib/mongodb', () => ({ default: (...args: unknown[]) => mockDbConnect(...args) }));

import handler from '@/pages/api/agent/firecrawl-webhook';

type ResMock = {
  statusCode?: number;
  body?: unknown;
  status: (code: number) => ResMock;
  json: (body: unknown) => ResMock;
};

function makeRes(): ResMock {
  return {
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function query() {
  return { exec: vi.fn().mockResolvedValue(null) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbConnect.mockResolvedValue(undefined);
  mockFindOneAndUpdate.mockImplementation(query);
  mockGenerateChatCompletion.mockResolvedValue({
    data: JSON.stringify({
      actionable: false,
      signal: 'none',
      confidence: 0.2,
      oneLiner: 'Routine page update',
    }),
  });
  mockRecordRecommendation.mockResolvedValue({ status: 'failed', error: 'unused', chainId: 42161 });
  mockRemember.mockResolvedValue(undefined);
});

describe('POST /api/agent/firecrawl-webhook TypeSafe shadow mode', () => {
  it('returns the baseline outcome without waiting for a pending optional assessment', async () => {
    mockAssessMacroSignalWithTypeSafe.mockReturnValue(new Promise(() => {}));
    const res = makeRes();

    await Promise.race([
      handler({
        method: 'POST',
        headers: { 'x-firecrawl-secret': 'test-secret' },
        query: {},
        body: {
          type: 'monitor.page',
          data: {
            url: 'https://example.com/central-bank',
            changeDetected: true,
            summary: 'Routine wording update.',
          },
        },
      } as never, res as never),
      new Promise((_, reject) => setTimeout(() => reject(new Error('webhook waited for optional assessment')), 100)),
    ]);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      acknowledged: true,
      action: 'not_actionable',
      signalLens: { status: 'shadow_started' },
    });
    expect(mockAssessMacroSignalWithTypeSafe).toHaveBeenCalledWith({
      sourceUrl: 'https://example.com/central-bank',
      sourceSummary: 'Routine wording update.',
      changeContent: 'Routine wording update.',
    });
    await Promise.resolve();
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceFingerprint: expect.any(String) }),
      expect.objectContaining({
        $set: expect.objectContaining({
          sourceUrl: 'https://example.com/central-bank',
          baseline: { signal: 'none', confidence: 0.2, actionable: false },
        }),
      }),
      { upsert: true },
    );
  });

  it('rejects non-POST requests before invoking either AI path', async () => {
    const res = makeRes();

    await handler({ method: 'GET', headers: { 'x-firecrawl-secret': 'test-secret' }, query: {}, body: {} } as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(mockGenerateChatCompletion).not.toHaveBeenCalled();
    expect(mockAssessMacroSignalWithTypeSafe).not.toHaveBeenCalled();
  });
});
