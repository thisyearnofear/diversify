import { describe, expect, it, vi, afterEach } from 'vitest';
import { EarnService } from '../earn-service';
import { NETWORKS } from '../../config';
import {
  getLiquidChainName,
  getVaultQuote,
  mapVaultsFyiNetworkToChainId,
  mapVaultsFyiNetworkToChainIdWithLog,
} from '../ai/yield-advisor.service';

/**
 * Helpers used by the three yield producers to stamp typed top-level
 * `chain` (name) and `chainId` (number) fields consistently, so the
 * focus-key helper (`deriveYieldFocusKey`) and the drawer's
 * `open_yield_review.chain` directly agree on the key shape across
 * vaults.fyi / GMX / free LI.FI rows.
 */
describe('yield-advisor helpers', () => {
  describe('mapVaultsFyiNetworkToChainId', () => {
    it('maps the canonical Arbitrum spellings to 42161', () => {
      expect(mapVaultsFyiNetworkToChainId('arbitrum')).toBe(42161);
      expect(mapVaultsFyiNetworkToChainId('Arbitrum One')).toBe(42161);
      expect(mapVaultsFyiNetworkToChainId('ARB')).toBe(42161);
    });

    it('maps common EVM chain names to their numeric chainIds', () => {
      expect(mapVaultsFyiNetworkToChainId('base')).toBe(8453);
      expect(mapVaultsFyiNetworkToChainId('Ethereum')).toBe(1);
      expect(mapVaultsFyiNetworkToChainId('Mainnet')).toBe(1);
      expect(mapVaultsFyiNetworkToChainId('optimism')).toBe(10);
      expect(mapVaultsFyiNetworkToChainId('polygon')).toBe(137);
    });

    it('is case-insensitive and trims whitespace', () => {
      expect(mapVaultsFyiNetworkToChainId('  ARBITRUM  ')).toBe(42161);
      expect(mapVaultsFyiNetworkToChainId('Base')).toBe(8453);
    });

    it('returns undefined for unknown networks rather than fabricating a chainId', () => {
      expect(mapVaultsFyiNetworkToChainId('unknown-chain')).toBeUndefined();
      expect(mapVaultsFyiNetworkToChainId('')).toBeUndefined();
    });
  });

  describe('mapVaultsFyiNetworkToChainIdWithLog (per-network dedupe + empty case)', () => {
    // The dedupe Set is module-scoped — `vi.resetModules()` between
    // dedupe-sensitive tests gives every warn-asserting test a fresh
    // module import (and therefore a fresh empty Set). Combined with
    // EXACT `toHaveLength(1)` assertions, this catches the real
    // regressions we care about: over-firing (count > 1 means dedupe
    // is broken) and under-firing (count = 0 means the helper silently
    // swallowed an unknown network).

    // Re-import the helper via `await import(...)` so each test can call
    // the freshly-reset module. The first import (top of file) is the
    // default; subsequent imports use vitest's mocked module system,
    // so we resolve to it dynamically.
    async function freshImport() {
      vi.resetModules();
      return await import('../ai/yield-advisor.service');
    }

    it('does NOT log for a known network', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { mapVaultsFyiNetworkToChainIdWithLog: helper } = await freshImport();
      const result = helper('arbitrum');
      expect(result).toBe(42161);
      // Known network → no warning at all.
      const yieldWarnings = warn.mock.calls.filter((args) => String(args[0]).includes('[yield]'));
      expect(yieldWarnings).toHaveLength(0);
      warn.mockRestore();
    });

    it('does log + dedupes for an unknown network (logs once across many calls)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { mapVaultsFyiNetworkToChainIdWithLog: helper } = await freshImport();
      helper('chain-test-alpha-2027');
      helper('chain-test-alpha-2027');
      helper('chain-test-alpha-2027');
      // Exact count: dedupe is the contract under test. If the helper
      // ever over-fires (count > 1) the dedupe breaking-change is caught
      // here. If it ever under-fires (count = 0) the silent-swallow
      // regression is caught here.
      const yieldWarnings = warn.mock.calls.filter((args) =>
        String(args[0]).includes('unknown vaults.fyi network'),
      );
      expect(yieldWarnings).toHaveLength(1);
      warn.mockRestore();
    });

    it('dedupes across case variants (different casing = same unknown network)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { mapVaultsFyiNetworkToChainIdWithLog: helper } = await freshImport();
      helper('chain-test-beta-2027');
      helper('CHAIN-TEST-BETA-2027');
      helper('  Chain-Test-Beta-2027  ');
      // Three case-variant calls collapse to ONE warning via the
      // lowercased + trimmed dedupe key. Over-firing = bad dedupe.
      const yieldWarnings = warn.mock.calls.filter((args) =>
        String(args[0]).includes('unknown vaults.fyi network'),
      );
      expect(yieldWarnings).toHaveLength(1);
      warn.mockRestore();
    });

    it('does warn for empty / whitespace-only / undefined network field (not silent)', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { mapVaultsFyiNetworkToChainIdWithLog: helper } = await freshImport();
      helper('');
      helper('   ');
      helper(undefined as unknown as string);
      // All three fall to the synthetic '__empty__' dedupe key. Three
      // calls collapse to ONE warning — that's the contract.
      const emptyWarnings = warn.mock.calls.filter((args) =>
        String(args[0]).includes('without a usable network field'),
      );
      expect(emptyWarnings).toHaveLength(1);
      // Pin the user-facing message, not the internal dedupe key.
      expect(emptyWarnings[0][0]).toMatch(/without a usable network field/);
      warn.mockRestore();
    });
  });

  describe('NETWORKS-driven loop pin (catches drift on every rename)', () => {
    // For every chainId NETWORKS exposes, the registry must surface its
    // canonical name (no override attempt by the extension layer).
    // A for-of loop in a single test was rejected in favor of explicit
    // nested cases so failures point at the specific chainId rather than
    // the loop index.
    for (const net of Object.values(NETWORKS) as Array<{ chainId: number; name: string }>) {
      it(`NETWORKS chainId ${net.chainId} → "${net.name}" via the merged registry`, () => {
        expect(getLiquidChainName(net.chainId)).toBe(net.name);
        // The auto-seeded canonical alias must round-trip back to the
        // chainId so producers sending the exact NETWORKS.name resolve
        // without a custom extension entry.
        expect(mapVaultsFyiNetworkToChainId(net.name)).toBe(net.chainId);
      });
    }
  });

  describe('getLiquidChainName', () => {
    it('returns NETWORKS name for chains we onboard (Arbitrum, Celo, Base, etc.)', () => {
      // NETWORKS contains ARBITRUM_ONE (42161) and CELO_MAINNET (42220).
      expect(getLiquidChainName(42161)).toBe('Arbitrum');
      expect(getLiquidChainName(42220)).toBe('Celo');
    });

    it('returns NETWORKS name for testnet chainIds (regression-bait for the merge refactor)', () => {
      // CRITICAL: the registry merge with NETWORKS at module init must
      // preserve testnet names like "Arbitrum Sepolia" and "Celo Sepolia"
      // so LI.FI testnet vaults surface with proper display names rather
      // than the stringified chainId. If this test ever fails, the focus
      // key for testnet rows silently drifted and the drawer's typed
      // action will mismatch.
      expect(getLiquidChainName(421614)).toBe('Arbitrum Sepolia');
      expect(getLiquidChainName(11142220)).toBe('Celo Sepolia');
    });

    it('falls back to a curated name map for LI.FI chains missing from NETWORKS', () => {
      // Base (8453) and Ethereum (1) are common LI.FI chains not in our
      // NETWORKS config — without this fallback, focus keys would mismatch
      // with the drawer's name-shaped `chain`.
      expect(getLiquidChainName(8453)).toBe('Base');
      expect(getLiquidChainName(1)).toBe('Ethereum');
      expect(getLiquidChainName(10)).toBe('Optimism');
      expect(getLiquidChainName(137)).toBe('Polygon');
    });

    it('last-resort fallback returns the stringified chainId so the focus key stays well-formed', () => {
      // Unknown chain: the producer still needs `chain` to compose into
      // `${chain}:${symbol}`. The numeric string is ugly but unambiguous
      // — the consumer can recognise and route on it.
      expect(getLiquidChainName(999999)).toBe('999999');
    });

    it('handles null/undefined and NaN chainId without throwing', () => {
      expect(getLiquidChainName(null)).toBe('');
      expect(getLiquidChainName(undefined)).toBe('');
      expect(getLiquidChainName(NaN)).toBe('');
      expect(getLiquidChainName(Infinity)).toBe('');
      expect(getLiquidChainName(-Infinity)).toBe('');
    });
  });

  describe('registry precision (NETWORKS-merge invariants)', () => {
    it('NETWORKS-overlapping chainIds inherit NETWORKS.name (the canonical source)', () => {
      // The architecture pins NETWORKS.name as canonical. Even if the
      // extension entry listed a different `name` value for an overlapping
      // chainId, NETWORKS must win. This test asserts the current
      // extensions agree (no override attempt), and serves as a canary
      // if a future engineer tries to override via the extension layer.
      expect(getLiquidChainName(42161)).toBe('Arbitrum');
      expect(getLiquidChainName(42220)).toBe('Celo');
    });

    it('extension aliases are additive for NETWORKS-overlapping chainIds', () => {
      // 'arb' comes from the extension; 'arbitrum' comes from NETWORKS.name
      // seeded into aliases. Both resolve to 42161.
      expect(mapVaultsFyiNetworkToChainId('arb')).toBe(42161);
      expect(mapVaultsFyiNetworkToChainId('arbitrum')).toBe(42161);
    });

    it('extension aliases work for NETWORKS-missing chainIds (Base, zkSync, Linea)', () => {
      // These chains aren't in NETWORKS — the extension entry IS the
      // canonical record. Aliases should be lowercase variants that
      // vaults.fyi might surface.
      expect(mapVaultsFyiNetworkToChainId('base')).toBe(8453);
      expect(mapVaultsFyiNetworkToChainId('zksync')).toBe(324);
      expect(mapVaultsFyiNetworkToChainId('zksync era')).toBe(324);
      expect(mapVaultsFyiNetworkToChainId('linea')).toBe(59144);
      expect(mapVaultsFyiNetworkToChainId('bsc')).toBe(56);
      expect(mapVaultsFyiNetworkToChainId('mainnet')).toBe(1);
    });
  });
});

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
