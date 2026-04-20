import { describe, expect, it, vi, afterEach } from 'vitest';
import { EarnService } from '../earn-service';
import { getVaultQuote } from '../ai/yield-advisor.service';

describe('YieldAdvisorService.getVaultQuote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses chain-aware token address and preserves destination vault chain', async () => {
    vi.spyOn(EarnService as any, 'ensureInitialized').mockImplementation(() => {});
    vi.spyOn(EarnService, 'getVaultDetails').mockResolvedValue({
      id: '0xvault',
      chainId: 8453,
      protocol: 'morpho',
      vaultAddress: '0xvault',
      name: 'Morpho USDC',
      asset: { address: '0xasset', symbol: 'USDC', decimals: 6 },
      apy: 8,
      tvl: 100_000,
      status: 'active',
      categories: ['stablecoins'],
      risk: 'low',
      description: 'test',
    });

    const fetchMock = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        transactionRequest: {
          to: '0xrouter',
          data: '0xabc',
          value: '0',
          from: '0xuser',
          chainId: 8453,
        },
        action: { fromAmount: '100' },
        estimate: { toAmount: '99', feeCosts: [], gasCosts: [] },
      }),
    } as any);

    await getVaultQuote('0xvault', '0xuser', 'USDm', 11142220);

    const quoteCall = fetchMock.mock.calls.find(call => String(call[0]).includes('/quote'));
    expect(quoteCall).toBeTruthy();
    const calledUrl = new URL(quoteCall![0] as string);
    expect(calledUrl.searchParams.get('fromChain')).toBe('11142220');
    expect(calledUrl.searchParams.get('toChain')).toBe('8453');
    expect(calledUrl.searchParams.get('fromToken')).toBe('0x874069fa1eb16d44d622f2e0ca25eea172369bc1');
    expect(calledUrl.searchParams.get('slippage')).toBe('0.005');
  });

  it('accepts direct token address input unchanged', async () => {
    vi.spyOn(EarnService, 'getVaultDetails').mockResolvedValue({
      id: '0xvault',
      chainId: 8453,
      protocol: 'morpho',
      vaultAddress: '0xvault',
      name: 'Morpho USDC',
      asset: { address: '0xasset', symbol: 'USDC', decimals: 6 },
      apy: 8,
      tvl: 100_000,
      status: 'active',
      categories: ['stablecoins'],
      risk: 'low',
      description: 'test',
    });

    const directAddress = '0x1111111111111111111111111111111111111111';
    const getDepositQuoteSpy = vi.spyOn(EarnService, 'getDepositQuote').mockResolvedValue({
      transactionRequest: {
        to: '0xrouter',
        data: '0x',
        value: '0',
        from: '0xuser',
        chainId: 8453,
      },
      estimate: {
        fromAmount: '100',
        toAmount: '99',
        feeUSD: '0.1',
        gasCosts: [],
      },
    });

    await getVaultQuote('0xvault', '0xuser', directAddress, 42220);

    expect(getDepositQuoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fromTokenAddress: directAddress,
      })
    );
  });

  it('returns null quote when token is not configured on source chain', async () => {
    vi.spyOn(EarnService, 'getVaultDetails').mockResolvedValue({
      id: '0xvault',
      chainId: 8453,
      protocol: 'morpho',
      vaultAddress: '0xvault',
      name: 'Morpho USDC',
      asset: { address: '0xasset', symbol: 'USDC', decimals: 6 },
      apy: 8,
      tvl: 100_000,
      status: 'active',
      categories: ['stablecoins'],
      risk: 'low',
      description: 'test',
    });

    const getDepositQuoteSpy = vi.spyOn(EarnService, 'getDepositQuote').mockResolvedValue({
      transactionRequest: {
        to: '0xrouter',
        data: '0x',
        value: '0',
        from: '0xuser',
        chainId: 8453,
      },
      estimate: {
        fromAmount: '100',
        toAmount: '99',
        feeUSD: '0.1',
        gasCosts: [],
      },
    });

    const result = await getVaultQuote('0xvault', '0xuser', 'USDC', 42220);

    expect(result).toEqual({ vault: null, quote: null });
    expect(getDepositQuoteSpy).not.toHaveBeenCalled();
  });

  it('returns null quote when vault is not active', async () => {
    vi.spyOn(EarnService, 'getVaultDetails').mockResolvedValue({
      id: '0xvault',
      chainId: 8453,
      protocol: 'morpho',
      vaultAddress: '0xvault',
      name: 'Morpho USDC',
      asset: { address: '0xasset', symbol: 'USDC', decimals: 6 },
      apy: 8,
      tvl: 100_000,
      status: 'deprecated',
      categories: ['stablecoins'],
      risk: 'low',
      description: 'test',
    });

    const getDepositQuoteSpy = vi.spyOn(EarnService, 'getDepositQuote');
    const result = await getVaultQuote('0xvault', '0xuser', 'USDm', 11142220);

    expect(result).toEqual({ vault: null, quote: null });
    expect(getDepositQuoteSpy).not.toHaveBeenCalled();
  });

  it('returns null quote when route output is invalid', async () => {
    vi.spyOn(EarnService, 'getVaultDetails').mockResolvedValue({
      id: '0xvault',
      chainId: 8453,
      protocol: 'morpho',
      vaultAddress: '0xvault',
      name: 'Morpho USDC',
      asset: { address: '0xasset', symbol: 'USDC', decimals: 6 },
      apy: 8,
      tvl: 100_000,
      status: 'active',
      categories: ['stablecoins'],
      risk: 'low',
      description: 'test',
    });

    vi.spyOn(EarnService, 'getDepositQuote').mockResolvedValue({
      transactionRequest: {
        to: '0xrouter',
        data: '0x',
        value: '0',
        from: '0xuser',
        chainId: 8453,
      },
      estimate: {
        fromAmount: '100',
        toAmount: '0',
        feeUSD: '0.1',
        gasCosts: [],
      },
    });

    const result = await getVaultQuote('0xvault', '0xuser', 'USDm', 11142220);
    expect(result).toEqual({ vault: null, quote: null });
  });
});
