import { afterEach, describe, expect, it, vi } from 'vitest';
import { EarnService, type EarnVault } from '../earn-service';

const originalLiFiApiKey = process.env.LIFI_API_KEY;

const buildVault = (overrides: Partial<EarnVault>): EarnVault => ({
  id: overrides.id || 'vault-1',
  chainId: overrides.chainId || 8453,
  protocol: overrides.protocol || 'aave',
  vaultAddress: overrides.vaultAddress || '0xvault',
  name: overrides.name || 'Test Vault',
  asset: overrides.asset || { address: '0xasset', symbol: 'USDC', decimals: 6 },
  apy: overrides.apy ?? 8,
  tvl: overrides.tvl ?? 100_000,
  status: overrides.status || 'active',
  categories: overrides.categories || ['stablecoins'],
  risk: overrides.risk || 'low',
  description: overrides.description || 'desc',
});

describe('EarnService.rankVaultsForRecommendation', () => {
  it('filters out deprecated, low-liquidity and non-positive APY vaults', () => {
    const ranked = EarnService.rankVaultsForRecommendation([
      buildVault({ id: 'good', apy: 9, tvl: 120_000, status: 'active' }),
      buildVault({ id: 'deprecated', apy: 15, tvl: 500_000, status: 'deprecated' }),
      buildVault({ id: 'tiny-tvl', apy: 20, tvl: 1_000, status: 'active' }),
      buildVault({ id: 'zero-apy', apy: 0, tvl: 300_000, status: 'active' }),
    ]);

    expect(ranked.map(v => v.id)).toEqual(['good']);
  });

  it('prefers lower risk when APY and TVL are similar', () => {
    const ranked = EarnService.rankVaultsForRecommendation([
      buildVault({ id: 'high-risk', risk: 'high', apy: 12, tvl: 1_200_000 }),
      buildVault({ id: 'medium-risk', risk: 'medium', apy: 11.8, tvl: 1_100_000 }),
      buildVault({ id: 'low-risk', risk: 'low', apy: 11.5, tvl: 1_000_000 }),
    ], {
      allowedRisk: ['low', 'medium', 'high'],
    });

    expect(ranked.map(v => v.id)).toEqual(['low-risk', 'medium-risk', 'high-risk']);
  });

  it('respects maxResults and keeps deterministic ordering on ties', () => {
    const ranked = EarnService.rankVaultsForRecommendation([
      buildVault({ id: 'c', apy: 10, tvl: 1_000_000 }),
      buildVault({ id: 'a', apy: 10, tvl: 2_000_000 }),
      buildVault({ id: 'b', apy: 10, tvl: 1_500_000 }),
    ], {
      maxResults: 2,
    });

    expect(ranked.map(v => v.id)).toEqual(['a', 'b']);
  });
});

describe('EarnService.getDepositQuote', () => {
  afterEach(() => {
    process.env.LIFI_API_KEY = originalLiFiApiKey;
    vi.restoreAllMocks();
  });

  it('uses explicit destination chain when provided for cross-chain deposit', async () => {
    process.env.LIFI_API_KEY = 'test-lifi-key';
    vi.spyOn(EarnService as any, 'ensureInitialized').mockImplementation(() => {});
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        transactionRequest: {
          to: '0xrouter',
          data: '0x',
          value: '0',
          from: '0xuser',
          chainId: 8453,
        },
        action: { fromAmount: '1000000' },
        estimate: { toAmount: '999000', feeCosts: [], gasCosts: [] },
      }),
    } as any);

    await EarnService.getDepositQuote({
      vaultId: '0xvault',
      fromChainId: 42220,
      toChainId: 8453,
      fromTokenAddress: '0xasset',
      fromAddress: '0xuser',
      amount: '1000000',
    });

    const quoteCall = fetchMock.mock.calls.find(call => String(call[0]).includes('/quote'));
    expect(quoteCall).toBeTruthy();
    const calledUrl = new URL(quoteCall![0] as string);
    expect(calledUrl.searchParams.get('fromChain')).toBe('42220');
    expect(calledUrl.searchParams.get('toChain')).toBe('8453');
    expect(quoteCall![1]).toMatchObject({
      headers: expect.objectContaining({
        'x-integrator-id': 'diversifi-minipay',
        'x-lifi-api-key': 'test-lifi-key',
      }),
    });
  });
});

describe('EarnService.fetchUserPositions', () => {
  afterEach(() => {
    process.env.LIFI_API_KEY = originalLiFiApiKey;
    vi.restoreAllMocks();
  });

  it('normalizes portfolio positions from Earn endpoint', async () => {
    process.env.LIFI_API_KEY = 'test-lifi-key';
    vi.spyOn(EarnService as any, 'ensureInitialized').mockImplementation(() => {});
    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            chainId: 8453,
            vaultAddress: '0xvault',
            amountUSD: '150.50',
            amount: '150000000',
            apy: 6.2,
          },
        ],
      }),
    } as any);

    const positions = await EarnService.fetchUserPositions('0xabc');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/v1/portfolio/0xabc/positions'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-lifi-api-key': 'test-lifi-key',
        }),
      })
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/v1/earn/');

    expect(positions).toEqual([
      {
        vaultId: '0xvault',
        chainId: 8453,
        userAddress: '0xabc',
        amount: '150000000',
        amountUSD: '150.50',
        apy: 6.2,
      },
    ]);
  });

  it('returns empty array on endpoint failure', async () => {
    process.env.LIFI_API_KEY = 'test-lifi-key';
    vi.spyOn(EarnService as any, 'ensureInitialized').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: false,
      statusText: 'Bad Request',
      json: async () => ({ message: 'bad request' }),
    } as any);

    const positions = await EarnService.fetchUserPositions('0xabc');
    expect(positions).toEqual([]);
  });
});
