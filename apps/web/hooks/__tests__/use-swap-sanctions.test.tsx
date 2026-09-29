/**
 * The sanctions screen gates the swap before any wallet prompt:
 * `blocked` aborts without calling SwapOrchestratorService.executeSwap;
 * `unavailable` fails open while the fees switch is off and closed when
 * NEXT_PUBLIC_FEATURE_FEES is on.
 */

// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ethers } from 'ethers';

const executeSwap = vi.hoisted(() => vi.fn((_p?: unknown, _c?: unknown) => Promise.resolve({ success: false } as unknown)));
const isSwapSupported = vi.hoisted(() => vi.fn((_p?: unknown) => true));

vi.mock('@diversifi/shared/src/services/swap/swap-orchestrator.service', () => ({
  SwapOrchestratorService: {
    executeSwap: (...args: unknown[]) => executeSwap(args[0], args[1]),
    isSwapSupported: (...args: unknown[]) => isSwapSupported(args[0]),
    getSwapType: () => 'same-chain',
    getEstimate: vi.fn(),
  },
}));

const signer = vi.hoisted(() => ({
  getAddress: vi.fn(async () => '0x1111111111111111111111111111111111111111'),
  provider: {
    getBalance: vi.fn(async () => ethers.utils.parseEther('1')),
  },
}));

vi.mock('@diversifi/shared/src/services/swap/provider-factory.service', () => ({
  ProviderFactoryService: {
    isWalletConnected: () => true,
    getCurrentChainId: vi.fn(async () => 42220),
    getSigner: vi.fn(async () => signer),
    clearWeb3Cache: vi.fn(),
  },
}));

vi.mock('@diversifi/shared/src/services/swap/chain-detection.service', () => ({
  ChainDetectionService: {
    isSupported: () => true,
    getNetworkName: () => 'Celo',
    isCrossChain: () => false,
    isCelo: () => true,
    isArbitrum: () => false,
  },
}));

vi.mock('@diversifi/shared/src/services/swap/error-handler', () => ({
  SwapErrorHandler: { handle: (_e: unknown, _a?: string) => 'handled' },
}));

vi.mock('@diversifi/shared/src/utils/environment', () => ({
  isMiniPayEnvironment: () => false,
}));

vi.mock('@diversifi/shared/src/modules/wallet/core/provider-registry', () => ({
  getWalletProvider: vi.fn(async () => null),
  setupWalletEventListenersForProvider: vi.fn(() => () => {}),
}));

vi.mock('@diversifi/shared/src/modules/wallet/core/chains', () => ({
  getAddChainParameter: vi.fn(),
  toHexChainId: vi.fn((id: number) => `0x${id.toString(16)}`),
}));

import { useSwap } from '../use-swap';
import { _resetScreenCache } from '@/lib/compliance-screen';

const SAVED_ENV = { ...process.env };
const PARAMS = { fromToken: 'USDm', toToken: 'KESm', amount: '5' };

function stubScreen(
  body: { status: string; reason?: string },
  ok = true,
  status = 200,
  retryAfter?: number,
) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      headers: new Headers(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
      json: async () => body,
    })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetScreenCache();
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
  vi.unstubAllGlobals();
});

describe('useSwap sanctions screen', () => {
  it('a blocked wallet aborts before any strategy executes', async () => {
    stubScreen({ status: 'blocked' });
    const { result } = renderHook(() => useSwap());

    let swapResult;
    await act(async () => {
      swapResult = await result.current.swap(PARAMS);
    });

    expect(executeSwap).not.toHaveBeenCalled();
    expect(swapResult!.success).toBe(false);
    expect(swapResult!.error).toContain('sanctions list');
    expect(result.current.step).toBe('error');
  });

  it('an unavailable screener still proceeds while fees are off', async () => {
    delete process.env.NEXT_PUBLIC_FEATURE_FEES;
    stubScreen({ status: 'unavailable', reason: 'missing_api_key' });
    executeSwap.mockResolvedValue({ success: true, txHash: '0xok' });
    const { result } = renderHook(() => useSwap());

    let swapResult;
    await act(async () => {
      swapResult = await result.current.swap(PARAMS);
    });

    expect(executeSwap).toHaveBeenCalled();
    expect(swapResult!.success).toBe(true);
  });

  it('an unavailable screener fails closed once fees are on', async () => {
    process.env.NEXT_PUBLIC_FEATURE_FEES = 'true';
    stubScreen({ status: 'unavailable' });
    const { result } = renderHook(() => useSwap());

    let swapResult;
    await act(async () => {
      swapResult = await result.current.swap(PARAMS);
    });

    expect(executeSwap).not.toHaveBeenCalled();
    expect(swapResult!.error).toContain('compliance check');
  });

  it('a rate-limited screen fails closed with a retry-after message', async () => {
    process.env.NEXT_PUBLIC_FEATURE_FEES = 'true';
    stubScreen(
      { status: 'unavailable', reason: 'rate_limited' },
      false,
      429,
      17,
    );
    const { result } = renderHook(() => useSwap());

    let swapResult;
    await act(async () => {
      swapResult = await result.current.swap(PARAMS);
    });

    expect(executeSwap).not.toHaveBeenCalled();
    expect(swapResult!.error).toContain('17 seconds');
  });
});
