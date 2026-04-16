import { describe, expect, it, vi, afterEach } from 'vitest';
import { EarnService } from '../earn-service';
import { getVaultQuote } from '../ai/yield-advisor.service';

describe('YieldAdvisorService.getVaultQuote', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses chain-aware token address and preserves destination vault chain', async () => {
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

    await getVaultQuote('0xvault', '0xuser', 'USDm', 11142220);

    expect(getDepositQuoteSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        fromChainId: 11142220,
        toChainId: 8453,
        fromTokenAddress: '0x874069fa1eb16d44d622f2e0ca25eea172369bc1',
      })
    );
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
});