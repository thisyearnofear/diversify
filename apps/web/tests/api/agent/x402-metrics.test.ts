// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDashboard = vi.fn();
const mockReport = vi.fn();
const mockGetAgentAddress = vi.fn();
const mockGetAgentUSDCBalance = vi.fn();
const mockGetSettlementStats = vi.fn();
const mockGetLedgerStats = vi.fn();
const mockWithTimeout = vi.fn();

vi.mock('@diversifi/shared', () => ({
  listArcResearchSources: () => [
    { id: 'macro', label: 'Macro source', price: '0.004' },
  ],
  x402Analytics: {
    getDashboardData: () => mockDashboard(),
    getAnalyticsReport: () => mockReport(),
  },
  getAgentAddress: () => mockGetAgentAddress(),
  getAgentUSDCBalance: (...args: unknown[]) => mockGetAgentUSDCBalance(...args),
  getSettlementStats: (...args: unknown[]) => mockGetSettlementStats(...args),
  getLedgerStats: (...args: unknown[]) => mockGetLedgerStats(...args),
  withTimeout: (...args: unknown[]) => mockWithTimeout(...args),
  DEFAULT_SETTLEMENT_NETWORK: 'ARBITRUM',
  SETTLEMENT_ENV: 'mainnet',
  getSettlementConfig: () => ({
    name: 'Arbitrum',
    recipientAddress: '0x0000000000000000000000000000000000000001',
    usdcAddress: '0x0000000000000000000000000000000000000002',
    explorerBase: 'https://arbiscan.io',
  }),
}));

import handler from '@/pages/api/agent/x402-metrics';

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

const dashboard = {
  totalPayments: 0,
  topSources: [],
  recentSpending: [],
  successRate: 0,
  averagePaymentTime: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockDashboard.mockReturnValue(dashboard);
  mockReport.mockReturnValue({ insights: [], recommendations: [] });
  mockGetAgentAddress.mockReturnValue(null);
  mockGetAgentUSDCBalance.mockResolvedValue(null);
  mockGetSettlementStats.mockResolvedValue(null);
  mockGetLedgerStats.mockResolvedValue({
    totalRecommendations: 42,
    contractAddress: '0x0000000000000000000000000000000000000003',
    chainId: 42161,
    isDeployed: true,
  });
  mockWithTimeout.mockImplementation((promise: Promise<unknown>) => promise);
});

describe('GET /api/agent/x402-metrics', () => {
  it('returns metrics and ledger data when RPC reads resolve', async () => {
    const res = makeRes();

    await handler({ method: 'GET' } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      zeroGIntegratedLedger: { totalRecommendations: 42, isDeployed: true },
      settlement: { network: 'ARBITRUM', agentAddress: null },
    });
  });

  it('reports buyer settlement stats (not the retired agent mirror)', async () => {
    mockGetSettlementStats.mockResolvedValue({
      proofSource: 'arbitrum_buyer_usdc_transfer_logs',
      excludedOperatorAddress: '0x0000000000000000000000000000000000000009',
      recipientAddress: '0x0000000000000000000000000000000000000001',
      tokenAddress: '0x0000000000000000000000000000000000000002',
      buyerSettlementCount: 3,
      totalBuyerSettledUSDC: '0.012000',
      latestTransferBlock: 123,
      recentBuyerTransfers: [
        {
          txHash: `0x${'ab'.repeat(32)}`,
          amountUSDC: '0.004000',
          blockNumber: 123,
          blockTimestamp: '2026-09-24T00:00:00.000Z',
          logIndex: 0,
          explorer: 'https://arbiscan.io/tx/0x...',
        },
      ],
      amountBreakdown: { '0.004000': 3 },
      network: 'ARBITRUM',
    });
    const res = makeRes();

    await handler({ method: 'GET' } as never, res as never);

    const body = res.body as { settlement: Record<string, unknown> };
    expect(res.statusCode).toBe(200);
    expect(body.settlement).toMatchObject({
      buyerSettlementCount: 3,
      totalBuyerSettledUSDC: '0.012000',
      recentBuyerTransfers: expect.any(Array),
    });
    expect(String(body.settlement.note)).toContain('Gateway batched');
    // The retired agent-mirror fields must not reappear.
    expect(body.settlement).not.toHaveProperty('settlementTxCount');
    expect(body.settlement).not.toHaveProperty('recentTransfers');
  });

  it('returns degraded metrics when a ledger RPC never resolves', async () => {
    mockGetLedgerStats.mockReturnValue(new Promise(() => {}));
    mockWithTimeout.mockRejectedValue(new Error('recommendation ledger stats timed out'));
    const res = makeRes();

    await handler({ method: 'GET' } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      zeroGIntegratedLedger: null,
      transactionFrequency: { evidenceSource: 'in_memory_fallback' },
    });
  });

  it('rejects non-GET requests', async () => {
    const res = makeRes();

    await handler({ method: 'POST' } as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: 'Method not allowed' });
  });
});
