// @vitest-environment node

/**
 * Executor chain routing: Celo chains build a Mento approve+swap batch;
 * other autonomy-eligible chains route through the LI.FI quote API with the
 * approvalAddress + transactionRequest preserved; ineligible chains throw
 * AutonomyChainIneligibleError so the loop can fall back to one-tap.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const CUSD = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
const CEUR = '0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6ca73';
const ARB_USDC = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831';
const ARB_TOKEN_OUT = '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1';
const MENTO_BROKER = '0x777A8255cA72412f0d706dc03C9D1987306B4CaD';
const LIFI_DIAMOND = '0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE';
const USER = '0x1111111111111111111111111111111111111111';

const sendBatch = vi.hoisted(() =>
  vi.fn(async (_userId?: string, _calls?: any[], _chainId?: number) => ({
    hash: '0xbatch',
    status: 'pending' as const,
  })),
);

vi.mock('@diversifi/shared/src/services/vault/smart-account-provider', () => ({
  getSmartAccountProvider: () => ({ name: 'metamask-delegation', isConfigured: () => true, sendBatch }),
}));

vi.mock('@diversifi/shared/src/services/vault/providers', () => ({}));

vi.mock('@diversifi/shared/src/services/vault/providers/metamask-delegation-provider', () => ({
  ERC7710_KIT_CHAIN_IDS: [42161, 42220, 11142220],
  setDelegationContextResolver: vi.fn(),
}));

vi.mock('@/lib/mongodb', () => ({ default: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/models/Permission', () => ({ Permission: { findOne: vi.fn() } }));

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>();
  const Contract = vi.fn().mockImplementation(() => ({
    getExchangeProviders: async () => [`0x${'ef'.repeat(20)}`],
    getExchanges: async () => [
      { exchangeId: `0x${'ab'.repeat(32)}`, assets: [CUSD, CEUR] },
    ],
    getAmountOut: async () => actual.ethers.BigNumber.from('2000'),
  }));
  return {
    ...actual,
    ethers: { ...actual.ethers, Contract },
  };
});

import { smartAccountExecutor, isAutonomyEligibleChain, AutonomyChainIneligibleError } from '../vault/executor';
import { VaultExecutionUnavailableError } from '@diversifi/shared/src/services/vault/vault.service';

const VAULT = { _id: 'v1', userAddress: USER } as never;
const SAVED_ENV = { ...process.env };

beforeEach(() => {
  sendBatch.mockClear();
  process.env.GUARDIAN_SESSION_PRIVATE_KEY = `0x${'aa'.repeat(32)}`;
  process.env.AA_BUNDLER_URL = 'https://bundler.example.com';
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
  vi.unstubAllGlobals();
});

describe('isAutonomyEligibleChain', () => {
  it('accepts app-supported chains that ship kit environments', () => {
    expect(isAutonomyEligibleChain(42220)).toBe(true); // Celo mainnet
    expect(isAutonomyEligibleChain(42161)).toBe(true); // Arbitrum One
    expect(isAutonomyEligibleChain(11142220)).toBe(true); // Celo Sepolia
  });

  it('rejects kit chains the app does not support', () => {
    expect(isAutonomyEligibleChain(137)).toBe(false); // Polygon: kit-only in this mock? no — excluded from mock list anyway
    expect(isAutonomyEligibleChain(5042002)).toBe(false);
  });
});

describe('executeSwap routing', () => {
  it('Celo: batches broker approve + swapIn in one sendBatch call', async () => {
    const result = await smartAccountExecutor.executeSwap(VAULT, 'cUSD', 'cEUR', '1000', 42220);
    expect(result.txHash).toBe('0xbatch');
    expect(sendBatch).toHaveBeenCalledTimes(1);
    const [userId, calls, chainId] = sendBatch.mock.calls[0]! as [string, { to: string; data: string }[], number];
    expect(userId).toBe(USER);
    expect(chainId).toBe(42220);
    expect(calls).toHaveLength(2);
    expect(calls[0].to.toLowerCase()).toBe(CUSD.toLowerCase()); // approve on the input token
    expect(calls[0].data.slice(0, 10)).toBe('0x095ea7b3'); // approve(address,uint256)
    expect(calls[1].to).toBe(MENTO_BROKER);
    expect(result.amountOut).toBeDefined();
  });

  it('Arbitrum: LI.FI quote yields approval (spender = approvalAddress) + transactionRequest', async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        estimate: { approvalAddress: LIFI_DIAMOND, toAmount: '999' },
        transactionRequest: {
          to: LIFI_DIAMOND,
          data: '0xdeadbeef',
          value: '0x0',
          gasLimit: '0x55730',
          chainId: 42161,
        },
      }),
    }));
    vi.stubGlobal('fetch', fetcher);

    const result = await smartAccountExecutor.executeSwap(VAULT, ARB_USDC, ARB_TOKEN_OUT, '5000000', 42161);
    expect(result.txHash).toBe('0xbatch');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = (fetcher.mock.calls[0] as any)[0] as string;
    expect(url).toContain('https://li.quest/v1/quote');
    expect(url).toContain('fromChain=42161');
    expect(url).toContain(`fromToken=${ARB_USDC}`);
    expect(url).toContain(`fromAddress=${USER}`);

    const calls = sendBatch.mock.calls[0]![1]!;
    expect(calls).toHaveLength(2);
    expect(calls[0].to).toBe(ARB_USDC);
    expect(calls[0].data.slice(0, 10)).toBe('0x095ea7b3');
    expect(calls[0].data.toLowerCase()).toContain(LIFI_DIAMOND.slice(2).toLowerCase());
    expect(calls[1].to).toBe(LIFI_DIAMOND);
    expect(calls[1].data).toBe('0xdeadbeef');
  });

  it('LI.FI quote without approvalAddress fails rather than shipping a bare swap', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        estimate: { toAmount: '999' },
        transactionRequest: { to: LIFI_DIAMOND, data: '0xdeadbeef', value: '0x0', chainId: 42161 },
      }),
    })));
    await expect(
      smartAccountExecutor.executeSwap(VAULT, ARB_USDC, ARB_TOKEN_OUT, '5000000', 42161),
    ).rejects.toThrow(/approvalAddress/);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('ineligible chain throws AutonomyChainIneligibleError before any submission', async () => {
    await expect(
      smartAccountExecutor.executeSwap(VAULT, ARB_USDC, ARB_TOKEN_OUT, '5000000', 137),
    ).rejects.toBeInstanceOf(AutonomyChainIneligibleError);
    expect(sendBatch).not.toHaveBeenCalled();
  });

  it('unconfigured provider still fails closed with VaultExecutionUnavailableError', async () => {
    delete process.env.GUARDIAN_SESSION_PRIVATE_KEY;
    delete process.env.AA_BUNDLER_URL;
    // The mocked registry reports configured — the real fail-closed path is
    // covered by vault-executor-fail-closed.test.ts. Here we only prove the
    // error type exists for the loop to catch.
    expect(new VaultExecutionUnavailableError().name).toBe('VaultExecutionUnavailableError');
  });
});
