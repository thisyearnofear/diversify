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

const mockRememberLedgerReasoning = vi.fn();
vi.mock('@/lib/ledger-reasoning-store', () => ({
  rememberLedgerReasoning: (...args: unknown[]) => mockRememberLedgerReasoning(...args),
}));

vi.mock('@/lib/mongodb', () => ({ default: (...args: unknown[]) => mockDbConnect(...args) }));

import handler from '@/pages/api/agent/firecrawl-webhook';
import { enqueueRecommendation } from '@/lib/vault/guardian-state';
import { guardianEventBus } from '@/lib/agent/guardian-event-bus';
import { Permission } from '@/models/Permission';
import { Vault } from '@/models/Vault';

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
    }, expect.objectContaining({
      // The route injects the server-side 'ai' loader lazily.
      evaluateGateway: expect.any(Function),
    }));
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

describe('POST /api/agent/firecrawl-webhook rehearsal handling', () => {
  const ACTIONABLE_MODEL = {
    // The model intentionally drops the rehearsal label — the server must
    // not depend on it keeping it.
    actionable: true,
    signal: 'rate_cut',
    confidence: 0.9,
    targetToken: 'cEUR',
    oneLiner: 'Central bank cut benchmark rates by 50bps',
    reasoning: 'Lower local yields reduce deposit attractiveness.',
  };

  const eligiblePermission = {
    userAddress: '0xuser0000000000000000000000000000000001',
    status: 'active',
    expiresAt: 0,
    allowedTokens: ['cEUR'],
  };
  const fundedVault = {
    userAddress: eligiblePermission.userAddress,
    allocations: [{ token: 'cUSD', valueUSD: 500 }],
  };

  function post(data: Record<string, unknown>) {
    const res = makeRes();
    return handler(
      {
        method: 'POST',
        headers: { 'x-firecrawl-secret': 'test-secret' },
        query: {},
        body: { type: 'monitor.page', data },
      } as never,
      res as never,
    ).then(() => res);
  }

  function arrangeEligibleUser() {
    vi.mocked(Permission.find).mockReturnValueOnce({
      lean: vi.fn().mockResolvedValue([eligiblePermission]),
    } as never);
    vi.mocked(Vault.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(fundedVault),
    } as never);
    mockGenerateChatCompletion.mockResolvedValue({ data: JSON.stringify(ACTIONABLE_MODEL) });
    mockRecordRecommendation.mockResolvedValue({
      status: 'pending',
      chainId: 42220,
      txHash: '0xanchor',
      explorerUrl: 'https://explorer/0xanchor',
      evidenceUploaded: false,
    });
  }

  const baseData = {
    url: 'https://example.com/central-bank',
    changeDetected: true,
    summary: 'Policy statement updated.',
  };

  it('metadata rehearsal: anchors MACRO_SIGNAL:REHEARSAL with a forced label and no side effects', async () => {
    arrangeEligibleUser();
    const res = await post({ ...baseData, metadata: { rehearsal: true } });

    expect(res.body).toMatchObject({
      action: 'rehearsal_propagated',
      rehearsal: true,
      usersUpdated: 0,
      usersWouldUpdate: 1,
      usersSkipped: 0,
    });
    // Same eligibility walk, zero fan-out.
    expect(enqueueRecommendation).not.toHaveBeenCalled();
    expect(guardianEventBus.publish).not.toHaveBeenCalled();
    // The fake signal never reaches Guardian memory.
    expect(mockRemember).not.toHaveBeenCalled();
    // A permanent anchor still lands — under the rehearsal action.
    expect(mockRecordRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MACRO_SIGNAL:REHEARSAL', targetToken: 'cEUR' }),
    );
    // The echo's readable label is forced server-side even though the model's
    // oneLiner carries no rehearsal marker.
    expect(mockRememberLedgerReasoning).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'MACRO_SIGNAL:REHEARSAL',
        reasoning:
          '[Rehearsal — not a market event] Central bank cut benchmark rates by 50bps. Source: https://example.com/central-bank',
      }),
    );
  });

  it('rehearsal.local URL alone marks the payload a rehearsal', async () => {
    arrangeEligibleUser();
    const res = await post({
      ...baseData,
      url: 'https://rehearsal.local/diversifi/macro-signal-check',
    });

    expect(res.body).toMatchObject({ action: 'rehearsal_propagated', rehearsal: true, usersUpdated: 0, usersWouldUpdate: 1 });
    expect(enqueueRecommendation).not.toHaveBeenCalled();
    expect(mockRemember).not.toHaveBeenCalled();
    expect(mockRecordRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MACRO_SIGNAL:REHEARSAL' }),
    );
    expect(mockRememberLedgerReasoning).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning: expect.stringContaining('Source: https://rehearsal.local/diversifi/macro-signal-check'),
      }),
    );
  });

  it('a normal payload still enqueues, publishes, remembers and anchors under the model signal', async () => {
    arrangeEligibleUser();
    const res = await post(baseData);

    expect(res.body).toMatchObject({ action: 'signal_propagated', usersUpdated: 1, usersSkipped: 0 });
    expect(enqueueRecommendation).toHaveBeenCalledWith(
      eligiblePermission.userAddress,
      expect.objectContaining({ action: 'REBALANCE', targetToken: 'cEUR' }),
    );
    expect(guardianEventBus.publish).toHaveBeenCalled();
    expect(mockRemember).toHaveBeenCalled();
    expect(mockRecordRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MACRO_SIGNAL:RATE_CUT' }),
    );
    expect(mockRememberLedgerReasoning).toHaveBeenCalledWith(
      expect.objectContaining({
        reasoning: 'Central bank cut benchmark rates by 50bps. Source: https://example.com/central-bank',
      }),
    );
  });
});
